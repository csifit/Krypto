import { isAddress, parseUnits } from "viem";
import { getActiveStablecoin } from "@/lib/assets";
import { ACTIVE_PAYMENT_NETWORK } from "@/lib/celo";
import type { BusinessPaymentRequest } from "@/lib/payments/businessRequest";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import {
  AuthError,
  getPrivyLinkedEvmAddresses,
  requirePrivyUser,
} from "@/lib/server/privy";
import {
  mapBusinessPaymentRequest,
} from "@/lib/server/paymentRequests";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

const MAX_MEMO_LENGTH = 120;

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("business_payment_requests")
      .select("id, recipient, asset_symbol, network, amount, memo, status, payment_tx_hash, created_at, paid_at, cancelled_at")
      .eq("privy_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return Response.json({
      requests: (data ?? []).map((row) => mapBusinessPaymentRequest(row)),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment request list failed", error);
    return Response.json({ error: "Could not load payment requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      recipient?: string;
      asset?: string;
      amount?: string;
      memo?: string;
    };

    if (!body.recipient || !isAddress(body.recipient)) {
      return Response.json({ error: "Invalid receive wallet" }, { status: 400 });
    }

    const asset = getActiveStablecoin(body.asset);
    if (!asset || asset.network !== ACTIVE_PAYMENT_NETWORK) {
      return Response.json({ error: "Unsupported payment request asset" }, { status: 400 });
    }

    let rawAmount: bigint;
    try {
      rawAmount = parseUnits(body.amount?.trim() ?? "", asset.decimals);
    } catch {
      return Response.json(
        { error: "Tracked payment requests require a valid fixed amount" },
        { status: 400 },
      );
    }

    if (rawAmount <= BigInt(0)) {
      return Response.json(
        { error: "Tracked payment requests require a fixed amount" },
        { status: 400 },
      );
    }

    const memo = body.memo?.trim() || null;
    if (memo && memo.length > MAX_MEMO_LENGTH) {
      return Response.json({ error: "Reference is too long" }, { status: 400 });
    }

    const linkedWallets = await getPrivyLinkedEvmAddresses(userId);
    if (!linkedWallets.has(body.recipient.toLowerCase())) {
      return Response.json(
        { error: "Receive wallet is not linked to this Krypto121 account" },
        { status: 403 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_payment_requests")
      .insert({
        privy_user_id: userId,
        recipient: body.recipient,
        asset_symbol: asset.symbol,
        network: asset.network,
        amount: body.amount!.trim(),
        memo,
        status: "pending",
      })
      .select("id, recipient, asset_symbol, network, amount, memo, status, payment_tx_hash, created_at, paid_at, cancelled_at")
      .single();

    if (error) throw error;

    return Response.json({
      request: mapBusinessPaymentRequest(data) as BusinessPaymentRequest,
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment request create failed", error);
    return Response.json({ error: "Could not create tracked payment request" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      id?: string;
      action?: "cancel";
    };

    if (!body.id || body.action !== "cancel") {
      return Response.json({ error: "Invalid payment request action" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_payment_requests")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("privy_user_id", userId)
      .eq("status", "pending")
      .select("id, recipient, asset_symbol, network, amount, memo, status, payment_tx_hash, created_at, paid_at, cancelled_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json(
        { error: "Pending payment request not found" },
        { status: 404 },
      );
    }

    return Response.json({ request: mapBusinessPaymentRequest(data) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment request cancel failed", error);
    return Response.json({ error: "Could not cancel payment request" }, { status: 500 });
  }
}
