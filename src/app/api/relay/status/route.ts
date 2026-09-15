import { getRelayStatus } from "@/lib/server/relay";
import { requirePrivyUser, AuthError } from "@/lib/server/privy";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId");

    if (!requestId) {
      return Response.json({ error: "Missing Relay request ID" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: saved, error: savedError } = await supabase
      .from("relay_quotes")
      .select("request_id, origin_chain_id, destination_chain_id, origin_tx_hash")
      .eq("privy_user_id", userId)
      .eq("request_id", requestId)
      .maybeSingle();

    if (savedError) throw savedError;
    if (!saved) {
      return Response.json({ error: "Relay quote not found" }, { status: 404 });
    }

    const status = await getRelayStatus(requestId);

    if (
      status.originChainId != null &&
      Number(saved.origin_chain_id) !== status.originChainId
    ) {
      throw new Error("Relay origin chain does not match the saved quote");
    }
    if (
      status.destinationChainId != null &&
      Number(saved.destination_chain_id) !== status.destinationChainId
    ) {
      throw new Error("Relay destination chain does not match the saved quote");
    }

    if (status.status === "success") {
      await supabase
        .from("relay_quotes")
        .update({
          status: "settled",
          destination_tx_hash: status.destinationTxHash ?? null,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("privy_user_id", userId)
        .eq("request_id", requestId);
    } else if (status.status === "failure") {
      await supabase
        .from("relay_quotes")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("privy_user_id", userId)
        .eq("request_id", requestId);
    } else if (status.status === "refund" || status.status === "fallback") {
      await supabase
        .from("relay_quotes")
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("privy_user_id", userId)
        .eq("request_id", requestId);
    }

    return Response.json({ status });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Relay status failed", error);
    return Response.json({ error: "Could not check Relay status" }, { status: 502 });
  }
}
