import { isAddress } from "viem";
import type { LocalPaymentRecord } from "@/lib/payments/types";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

function mapPayment(row: {
  id: string;
  intent: unknown;
  quote: unknown;
  tx_hash: string;
  status: string;
  settled_at: string;
  beneficiary_name: string | null;
}) {
  return {
    id: row.id,
    intent: row.intent,
    quote: row.quote,
    txHash: row.tx_hash,
    status: row.status,
    settledAt: row.settled_at,
    beneficiaryName: row.beneficiary_name ?? undefined,
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
      .select("id, intent, quote, tx_hash, status, settled_at, beneficiary_name")
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
        settled_at: record.settledAt,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment save failed", error);
    return Response.json({ error: "Could not save payment record" }, { status: 500 });
  }
}
