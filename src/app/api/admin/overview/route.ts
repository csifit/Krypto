import { AccessPolicyError, requireSuperAdmin } from "@/lib/server/access";
import { getOperationalSettings } from "@/lib/server/operations";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { getCeloRpcHealth } from "@/lib/server/rpc";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSuperAdmin(userId);

    const supabase = getSupabaseAdmin();
    const [settings, rpcHealth, usersResult, auditResult] = await Promise.all([
      getOperationalSettings(),
      getCeloRpcHealth(),
      supabase
        .from("profiles")
        .select(
          "privy_user_id, email, wallet_address, role, account_status, status_reason, status_changed_at, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("admin_audit_log")
        .select("id, actor_privy_user_id, action, target_privy_user_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (usersResult.error) throw usersResult.error;
    if (auditResult.error) throw auditResult.error;

    const users = (usersResult.data ?? []).map((row: {
      privy_user_id: string;
      email: string | null;
      wallet_address: string | null;
      role: string;
      account_status: string;
      status_reason: string | null;
      status_changed_at: string | null;
      created_at: string;
    }) => ({
      privyUserId: row.privy_user_id,
      email: row.email ?? undefined,
      walletAddress: row.wallet_address ?? undefined,
      role: row.role,
      accountStatus: row.account_status,
      statusReason: row.status_reason ?? undefined,
      statusChangedAt: row.status_changed_at ?? undefined,
      createdAt: row.created_at,
    }));

    const audit = (auditResult.data ?? []).map((row: {
      id: string;
      actor_privy_user_id: string;
      action: string;
      target_privy_user_id: string | null;
      details: Record<string, unknown> | null;
      created_at: string;
    }) => ({
      id: row.id,
      actorUserId: row.actor_privy_user_id,
      action: row.action,
      targetUserId: row.target_privy_user_id ?? undefined,
      details: row.details ?? {},
      createdAt: row.created_at,
    }));

    return Response.json({ settings, rpcHealth, users, audit });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("admin overview failed", error);
    return Response.json({ error: "Could not load administration" }, { status: 500 });
  }
}
