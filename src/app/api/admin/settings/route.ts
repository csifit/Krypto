import { parseUnits } from "viem";
import { AccessPolicyError, requireSuperAdmin } from "@/lib/server/access";
import { getOperationalSettings, writeAdminAudit } from "@/lib/server/operations";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSuperAdmin(userId);

    const body = (await request.json()) as {
      paymentsEnabled?: boolean;
      mainnetPaymentsEnabled?: boolean;
      maxPaymentAmount?: string | null;
    };

    const current = await getOperationalSettings();
    const nextPaymentsEnabled =
      typeof body.paymentsEnabled === "boolean"
        ? body.paymentsEnabled
        : current.paymentsEnabled;
    const nextMainnetPaymentsEnabled =
      typeof body.mainnetPaymentsEnabled === "boolean"
        ? body.mainnetPaymentsEnabled
        : current.mainnetPaymentsEnabled;

    let nextMaxPaymentAmount: string | null = current.maxPaymentAmount ?? null;
    if (body.maxPaymentAmount === null || body.maxPaymentAmount === "") {
      nextMaxPaymentAmount = null;
    } else if (typeof body.maxPaymentAmount === "string") {
      try {
        if (parseUnits(body.maxPaymentAmount, 18) <= BigInt(0)) {
          throw new Error("invalid");
        }
      } catch {
        return Response.json(
          { error: "Maximum payment amount must be a positive decimal value or left blank" },
          { status: 400 },
        );
      }
      nextMaxPaymentAmount = body.maxPaymentAmount;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("operational_settings")
      .update({
        payments_enabled: nextPaymentsEnabled,
        mainnet_payments_enabled: nextMainnetPaymentsEnabled,
        max_payment_amount: nextMaxPaymentAmount,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", 1);

    if (error) throw error;

    await writeAdminAudit({
      actorUserId: userId,
      action: "operational_settings.updated",
      details: {
        paymentsEnabled: {
          from: current.paymentsEnabled,
          to: nextPaymentsEnabled,
        },
        mainnetPaymentsEnabled: {
          from: current.mainnetPaymentsEnabled,
          to: nextMainnetPaymentsEnabled,
        },
        maxPaymentAmount: {
          from: current.maxPaymentAmount ?? null,
          to: nextMaxPaymentAmount,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("admin settings update failed", error);
    return Response.json({ error: "Could not update operational settings" }, { status: 500 });
  }
}
