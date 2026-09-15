import { getSupabaseAdmin } from "@/lib/server/supabase";

export type OperationalSettings = {
  paymentsEnabled: boolean;
  mainnetPaymentsEnabled: boolean;
  maxPaymentAmount?: string;
  updatedAt: string;
  updatedBy?: string;
};

export async function getOperationalSettings(): Promise<OperationalSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("operational_settings")
    .select("payments_enabled, mainnet_payments_enabled, max_payment_amount, updated_at, updated_by")
    .eq("id", 1)
    .single();

  if (error) throw error;

  return {
    paymentsEnabled: data.payments_enabled,
    mainnetPaymentsEnabled: data.mainnet_payments_enabled,
    maxPaymentAmount:
      data.max_payment_amount == null ? undefined : String(data.max_payment_amount),
    updatedAt: data.updated_at,
    updatedBy: data.updated_by ?? undefined,
  };
}

export async function writeAdminAudit(input: {
  actorUserId: string;
  action: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_privy_user_id: input.actorUserId,
    action: input.action,
    target_privy_user_id: input.targetUserId ?? null,
    details: input.details ?? {},
  });

  if (error) throw error;
}
