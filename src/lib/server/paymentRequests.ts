import { isAddress, parseUnits } from "viem";
import { ACTIVE_PAYMENT_NETWORK } from "@/lib/celo";
import { getActiveStablecoin } from "@/lib/assets";
import type { LocalPaymentRecord } from "@/lib/payments/types";
import type { BusinessPaymentRequest } from "@/lib/payments/businessRequest";
import { getBusinessName } from "@/lib/server/businessProfile";
import { getPrivyLinkedEvmAddresses } from "@/lib/server/privy";
import { getSupabaseAdmin } from "@/lib/server/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAYMENT_REQUEST_SELECT =
  "id, recipient, asset_symbol, network, amount, memo, business_name_snapshot, external_reference, status, payment_tx_hash, created_at, paid_at, cancelled_at";

const MAX_MEMO_LENGTH = 120;
const MAX_EXTERNAL_REFERENCE_LENGTH = 120;

type PaymentRequestRow = {
  id: string;
  recipient: string;
  asset_symbol: string;
  network: string;
  amount: string | number;
  memo: string | null;
  business_name_snapshot: string | null;
  external_reference: string | null;
  status: "pending" | "paid" | "cancelled";
  payment_tx_hash: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
};

export class TrackedPaymentRequestError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "TrackedPaymentRequestError";
  }
}

export function mapBusinessPaymentRequest(
  row: PaymentRequestRow,
): BusinessPaymentRequest {
  return {
    id: row.id,
    recipient: row.recipient as `0x${string}`,
    asset: row.asset_symbol as BusinessPaymentRequest["asset"],
    network: row.network as BusinessPaymentRequest["network"],
    amount: String(row.amount),
    memo: row.memo ?? undefined,
    businessName: row.business_name_snapshot ?? undefined,
    externalReference: row.external_reference ?? undefined,
    status: row.status,
    paymentTxHash: row.payment_tx_hash
      ? (row.payment_tx_hash as `0x${string}`)
      : undefined,
    createdAt: row.created_at,
    paidAt: row.paid_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
  };
}

function normalizedAmount(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function normalizeExternalReference(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  if (normalized.length > MAX_EXTERNAL_REFERENCE_LENGTH) {
    throw new TrackedPaymentRequestError(
      `External reference must be ${MAX_EXTERNAL_REFERENCE_LENGTH} characters or less`,
    );
  }

  return normalized;
}

export async function listTrackedPaymentRequestsForUser(
  userId: string,
  limit = 100,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_payment_requests")
    .select(PAYMENT_REQUEST_SELECT)
    .eq("privy_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapBusinessPaymentRequest(row as PaymentRequestRow),
  );
}

export async function getTrackedPaymentRequestForUser(
  userId: string,
  id: string,
) {
  if (!UUID_RE.test(id)) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_payment_requests")
    .select(PAYMENT_REQUEST_SELECT)
    .eq("privy_user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data
    ? mapBusinessPaymentRequest(data as PaymentRequestRow)
    : null;
}

export async function getTrackedPaymentRequestByExternalReference(
  userId: string,
  externalReference: string,
) {
  const normalized = normalizeExternalReference(externalReference);
  if (!normalized) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_payment_requests")
    .select(PAYMENT_REQUEST_SELECT)
    .eq("privy_user_id", userId)
    .eq("external_reference", normalized)
    .maybeSingle();

  if (error) throw error;
  return data
    ? mapBusinessPaymentRequest(data as PaymentRequestRow)
    : null;
}

export async function createTrackedPaymentRequestForUser(input: {
  userId: string;
  recipient: string;
  assetSymbol: string;
  amount: string;
  memo?: string;
  externalReference?: string;
}) {
  if (!isAddress(input.recipient)) {
    throw new TrackedPaymentRequestError("Invalid receive wallet");
  }

  const asset = getActiveStablecoin(input.assetSymbol);
  if (!asset || asset.network !== ACTIVE_PAYMENT_NETWORK) {
    throw new TrackedPaymentRequestError(
      "Unsupported payment request asset",
    );
  }

  const amount = input.amount.trim();
  let rawAmount: bigint;

  try {
    rawAmount = parseUnits(amount, asset.decimals);
  } catch {
    throw new TrackedPaymentRequestError(
      "Tracked payment requests require a valid fixed amount",
    );
  }

  if (rawAmount <= BigInt(0)) {
    throw new TrackedPaymentRequestError(
      "Tracked payment requests require a fixed amount",
    );
  }

  const memo = input.memo?.trim() || undefined;
  if (memo && memo.length > MAX_MEMO_LENGTH) {
    throw new TrackedPaymentRequestError("Reference is too long");
  }

  const externalReference = normalizeExternalReference(
    input.externalReference,
  );

  const linkedWallets = await getPrivyLinkedEvmAddresses(input.userId);
  if (!linkedWallets.has(input.recipient.toLowerCase())) {
    throw new TrackedPaymentRequestError(
      "Receive wallet is not linked to this Krypto121 account",
      403,
    );
  }

  if (externalReference) {
    const existing =
      await getTrackedPaymentRequestByExternalReference(
        input.userId,
        externalReference,
      );

    if (existing) {
      const sameRequest =
        sameAddress(existing.recipient, input.recipient) &&
        existing.asset === asset.symbol &&
        normalizedAmount(existing.amount) ===
          normalizedAmount(amount) &&
        (existing.memo ?? "") === (memo ?? "");

      if (!sameRequest) {
        throw new TrackedPaymentRequestError(
          "External reference already belongs to a different payment request",
          409,
        );
      }

      return {
        request: existing,
        reused: true,
      };
    }
  }

  const businessName = await getBusinessName(input.userId);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("business_payment_requests")
    .insert({
      privy_user_id: input.userId,
      recipient: input.recipient,
      asset_symbol: asset.symbol,
      network: asset.network,
      amount,
      memo: memo ?? null,
      business_name_snapshot: businessName ?? null,
      external_reference: externalReference ?? null,
      status: "pending",
    })
    .select(PAYMENT_REQUEST_SELECT)
    .single();

  if (error?.code === "23505" && externalReference) {
    const existing =
      await getTrackedPaymentRequestByExternalReference(
        input.userId,
        externalReference,
      );

    if (existing) {
      const sameRequest =
        sameAddress(existing.recipient, input.recipient) &&
        existing.asset === asset.symbol &&
        normalizedAmount(existing.amount) ===
          normalizedAmount(amount) &&
        (existing.memo ?? "") === (memo ?? "");

      if (!sameRequest) {
        throw new TrackedPaymentRequestError(
          "External reference already belongs to a different payment request",
          409,
        );
      }

      return {
        request: existing,
        reused: true,
      };
    }
  }

  if (error) throw error;

  return {
    request: mapBusinessPaymentRequest(data as PaymentRequestRow),
    reused: false,
  };
}

export async function cancelTrackedPaymentRequestForUser(
  userId: string,
  id: string,
) {
  if (!UUID_RE.test(id)) {
    throw new TrackedPaymentRequestError(
      "Pending payment request not found",
      404,
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_payment_requests")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("privy_user_id", userId)
    .eq("status", "pending")
    .select(PAYMENT_REQUEST_SELECT)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new TrackedPaymentRequestError(
      "Pending payment request not found",
      404,
    );
  }

  return mapBusinessPaymentRequest(data as PaymentRequestRow);
}

export async function getPublicTrackedPaymentRequest(
  id: string,
): Promise<BusinessPaymentRequest | null> {
  if (!UUID_RE.test(id)) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_payment_requests")
    .select(PAYMENT_REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data
    ? mapBusinessPaymentRequest(data as PaymentRequestRow)
    : null;
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
    .select(PAYMENT_REQUEST_SELECT)
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
    normalizedAmount(String(row.amount)) ===
      normalizedAmount(destinationAmount);

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
