import { isAddress } from "viem";
import type { LocalPaymentRecord } from "@/lib/payments/types";
import { AuthError, getPrivyLinkedEvmAddresses, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { verifyPaymentSettlement } from "@/lib/server/settlement";

export const runtime = "nodejs";

function mapPayment(row: {
  id: string;
  intent: unknown;
  quote: unknown;
  tx_hash: string;
  status: string;
  settled_at: string;
  beneficiary_name: string | null;
  verified_at: string | null;
  settlement_block_number: string | number | null;
  chain_id: string | number | null;
}) {
  return {
    id: row.id,
    intent: row.intent,
    quote: row.quote,
    txHash: row.tx_hash,
    status: row.status,
    settledAt: row.settled_at,
    beneficiaryName: row.beneficiary_name ?? undefined,
    verification:
      row.verified_at && row.settlement_block_number != null && row.chain_id != null
        ? {
            onchain: true,
            chainId: Number(row.chain_id),
            blockNumber: String(row.settlement_block_number),
            verifiedAt: row.verified_at,
          }
        : undefined,
  } as LocalPaymentRecord;
}

function validTxHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("payments")
      .select("id, intent, quote, tx_hash, status, settled_at, beneficiary_name, verified_at, settlement_block_number, chain_id")
      .eq("privy_user_id", userId)
      .order("settled_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return Response.json({ payments: (data ?? []).map(mapPayment) });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment list failed", error);
    return Response.json({ error: "Could not load payment history" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const body = (await request.json()) as {
      walletAddress?: string;
      record?: LocalPaymentRecord;
    };
    const record = body.record;

    if (!body.walletAddress || !isAddress(body.walletAddress)) {
      return Response.json({ error: "Invalid account wallet" }, { status: 400 });
    }
    if (!record || record.status !== "settled" || !validTxHash(record.txHash)) {
      return Response.json({ error: "Invalid payment record" }, { status: 400 });
    }
    if (
      !isAddress(record.intent.sourceWallet) ||
      !isAddress(record.intent.destination)
    ) {
      return Response.json({ error: "Invalid payment wallet" }, { status: 400 });
    }

    const linkedWallets = await getPrivyLinkedEvmAddresses(userId);
    const accountWalletOwned = linkedWallets.has(body.walletAddress.toLowerCase());
    const sourceWalletOwned = linkedWallets.has(record.intent.sourceWallet.toLowerCase());

    if (!accountWalletOwned) {
      return Response.json(
        { error: "Account wallet is not linked to this Krypto121 account" },
        { status: 403 },
      );
    }

    if (!sourceWalletOwned) {
      return Response.json(
        { error: "Source wallet is not linked to this Krypto121 account" },
        { status: 403 },
      );
    }

    let verified;
    try {
      verified = await verifyPaymentSettlement(record);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not verify blockchain settlement";
      return Response.json({ error: message }, { status: 422 });
    }

    await ensureProfile(userId, body.walletAddress);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("payments").upsert(
      {
        id: record.id,
        privy_user_id: userId,
        source_wallet: record.intent.sourceWallet,
        destination: record.intent.destination,
        asset_symbol: record.intent.sourceAsset.symbol,
        network:
          record.intent.sourceAsset.type === "crypto"
            ? record.intent.sourceAsset.network
            : null,
        source_amount: record.intent.sourceAmount,
        memo: record.intent.memo ?? null,
        beneficiary_name: record.beneficiaryName ?? null,
        tx_hash: record.txHash,
        status: "settled",
        intent: record.intent,
        quote: record.quote,
        settled_at: verified.settledAt,
        verified_at: new Date().toISOString(),
        settlement_block_number: verified.blockNumber.toString(),
        chain_id: verified.chainId,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (error) {
      if (error.code === "23505") {
        return Response.json(
          { error: "This blockchain transaction is already recorded" },
          { status: 409 },
        );
      }
      throw error;
    }
    return Response.json({ ok: true, verified: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment save failed", error);
    return Response.json({ error: "Could not save payment record" }, { status: 500 });
  }
}
