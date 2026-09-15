import { isAddress } from "viem";
import { getRelayUsdcToBaseQuote } from "@/lib/server/relay";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { requireSensitiveAction, AccessPolicyError } from "@/lib/server/access";
import {
  AuthError,
  getPrivyLinkedEvmAddresses,
  requirePrivyUser,
} from "@/lib/server/privy";
import { getOperationalSettings } from "@/lib/server/operations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      sourceWallet?: string;
      recipient?: string;
      destinationAmount?: string;
    };

    if (!body.sourceWallet || !isAddress(body.sourceWallet)) {
      return Response.json({ error: "Invalid source wallet" }, { status: 400 });
    }
    if (!body.recipient || !isAddress(body.recipient)) {
      return Response.json({ error: "Invalid recipient wallet" }, { status: 400 });
    }

    const linked = await getPrivyLinkedEvmAddresses(userId);
    if (!linked.has(body.sourceWallet.toLowerCase())) {
      return Response.json(
        { error: "Source wallet is not linked to this Krypto121 account" },
        { status: 403 },
      );
    }

    const settings = await getOperationalSettings();
    if (!settings.paymentsEnabled || !settings.mainnetPaymentsEnabled) {
      return Response.json(
        { error: "Mainnet payments are currently unavailable." },
        { status: 503 },
      );
    }

    const quote = await getRelayUsdcToBaseQuote({
      sourceWallet: body.sourceWallet as `0x${string}`,
      recipient: body.recipient as `0x${string}`,
      destinationAmount: body.destinationAmount ?? "",
    });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("relay_quotes").upsert(
      {
        privy_user_id: userId,
        request_id: quote.requestId,
        source_wallet: quote.sourceWallet,
        recipient: quote.recipient,
        origin_chain_id: quote.originChainId,
        destination_chain_id: quote.destinationChainId,
        origin_currency: quote.originCurrency,
        destination_currency: quote.destinationCurrency,
        source_amount_raw: quote.sourceAmountRaw,
        destination_amount_raw: quote.destinationAmountRaw,
        source_amount: quote.sourceAmount,
        destination_amount: quote.destinationAmount,
        expires_at: quote.expiresAt,
        status: "quoted",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id" },
    );

    if (error) throw error;

    return Response.json({ quote });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Relay quote failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not quote Relay route" },
      { status: 502 },
    );
  }
}
