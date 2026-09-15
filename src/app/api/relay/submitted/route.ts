import { requirePrivyUser, AuthError } from "@/lib/server/privy";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

function validHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const body = (await request.json()) as {
      requestId?: string;
      txHash?: string;
    };

    if (!body.requestId || !validHash(body.txHash)) {
      return Response.json({ error: "Invalid Relay submission" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("relay_quotes")
      .update({
        origin_tx_hash: body.txHash,
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("privy_user_id", userId)
      .eq("request_id", body.requestId)
      .select("request_id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Relay quote not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Relay submission save failed", error);
    return Response.json({ error: "Could not save Relay submission" }, { status: 500 });
  }
}
