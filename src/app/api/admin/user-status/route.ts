import { AccessPolicyError } from "@/lib/server/access";
import { AdminElevationError, requireElevatedSuperAdmin } from "@/lib/server/adminElevation";
import { writeAdminAudit } from "@/lib/server/operations";
import { AuthError } from "@/lib/server/privy";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

type AccountStatus = "active" | "suspended" | "blocked";

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireElevatedSuperAdmin(request);

    const body = (await request.json()) as {
      targetUserId?: string;
      status?: AccountStatus;
      reason?: string;
    };

    const targetUserId = body.targetUserId?.trim();
    const status = body.status;
    const reason = body.reason?.trim() ?? "";

    if (!targetUserId) {
      return Response.json({ error: "Target user is required" }, { status: 400 });
    }
    if (status !== "active" && status !== "suspended" && status !== "blocked") {
      return Response.json({ error: "Invalid account status" }, { status: 400 });
    }
    if (status !== "active" && !reason) {
      return Response.json(
        { error: "A reason is required to suspend or block an account" },
        { status: 400 },
      );
    }
    if (targetUserId === userId) {
      return Response.json(
        { error: "A super admin cannot change their own account status" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("privy_user_id, role, account_status")
      .eq("privy_user_id", targetUserId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    if (target.role === "super_admin") {
      return Response.json(
        { error: "Super admin accounts cannot be restricted from this screen" },
        { status: 400 },
      );
    }

    const previousStatus = target.account_status;
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        account_status: status,
        status_reason: status === "active" ? null : reason,
        status_changed_at: now,
        status_changed_by: userId,
      })
      .eq("privy_user_id", targetUserId);

    if (updateError) throw updateError;

    await writeAdminAudit({
      actorUserId: userId,
      action:
        status === "active"
          ? "user.reactivated"
          : status === "suspended"
            ? "user.suspended"
            : "user.blocked",
      targetUserId,
      details: {
        from: previousStatus,
        to: status,
        reason: reason || undefined,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof AccessPolicyError ||
      error instanceof AdminElevationError
    ) {
      return Response.json(
        {
          error: error.message,
          code:
            error instanceof AdminElevationError ? error.code : undefined,
        },
        { status: error.status },
      );
    }
    console.error("admin user status update failed", error);
    return Response.json({ error: "Could not update account status" }, { status: 500 });
  }
}
