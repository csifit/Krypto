import type { LocalPaymentRecord } from "@/lib/payments/types";
import type { BusinessPaymentRequest } from "@/lib/payments/businessRequest";
import { getSupabaseAdmin } from "@/lib/server/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PaymentRequestRow = {
  id: string;
  recipient: string;
  asset_symbol: string;
  network: string;
  amount: string | number;
  memo: string | null;
  business_name_snapshot: string | null;
  status: "pending" | "paid" | "cancelled";
  payment_tx_hash: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
};

export function mapBusinessPaymentRequest(row: PaymentRequestRow): BusinessPaymentRequest {
  return {
    id: row.id,
    recipient: row.recipient as `0x${string}`,
    asset: row.asset_symbol as BusinessPaymentRequest["asset"],
    network: row.network as BusinessPaymentRequest["network"],
    amount: String(row.amount),
    memo: row.memo ?? undefined,
    businessName: row.business_name_snapshot ?? undefined,
    status: row.status,
    paymentTxHash: row.payment_tx_hash ? (row.payment_tx_hash as `0x${string}`) : undefined,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
  };
}

export async function getPublicTrackedPaymentRequest(
  id: string,
): Promise<BusinessPaymentRequest | null> {
  if (!UUID_RE.test(id)) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_payment_requests")
    .select("id, recipient, asset_symbol, network, amount, memo, business_name_snapshot, status, payment_tx_hash, created_at, paid_at, cancelled_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapBusinessPaymentRequest(data as PaymentRequestRow) : null;
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function normalizedAmount(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export async function reconcileTrackedPaymentRequest(
  record: LocalPaymentRecord,
  settledAt: string,
) {
  const requestId = record.intent.paymentRequestId;
  if (!requestId || !UUID_RE.test(requestId)) return false;
  if (
    record.quote.route.kind !== "direct-celo" ||
    record.intent.destinationAsset.type !== "crypto"
  ) {
    return false;
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("business_payment_requests")
    .select("id, recipient, asset_symbol, network, amount, memo, business_name_snapshot, status, payment_tx_hash, created_at, paid_at, cancelled_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!row || row.status !== "pending") return false;

  const destinationAmount =
    record.intent.destinationAmount ?? record.intent.sourceAmount;

  const matches =
    sameAddress(row.recipient, record.intent.destination) &&
    row.asset_symbol === record.intent.destinationAsset.symbol &&
    row.network === record.intent.destinationAsset.network &&
    normalizedAmount(String(row.amount)) === normalizedAmount(destinationAmount);

  if (!matches) return false;

  const { data: updated, error: updateError } = await supabase
    .from("business_payment_requests")
    .update({
      status: "paid",
      payment_tx_hash: record.txHash,
      paid_at: settledAt,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  return Boolean(updated);
}
