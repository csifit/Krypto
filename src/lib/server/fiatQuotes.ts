import type { FiatQuote, FiatQuoteRequest, FiatSessionState } from "@/lib/fiat/types";
import { getSupabaseAdmin } from "@/lib/server/supabase";

type FiatQuoteRow = {
  id: string;
  privy_user_id: string;
  provider_id: string;
  provider_quote_id: string;
  request_payload: FiatQuoteRequest;
  quote_payload: FiatQuote;
  expires_at: string;
  created_at: string;
};

type FiatSessionRow = {
  id: string;
  privy_user_id: string;
  quote_id: string;
  provider_id: string;
  provider_session_id: string;
  status: string;
  source_amount: string | null;
  destination_amount: string | null;
  transaction_reference: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function saveFiatQuote(
  userId: string,
  request: FiatQuoteRequest,
  quote: FiatQuote,
) {
  const { data, error } = await getSupabaseAdmin()
    .from("fiat_quotes")
    .insert({
      privy_user_id: userId,
      provider_id: quote.providerId,
      provider_quote_id: quote.providerQuoteId,
      request_payload: request,
      quote_payload: quote,
      expires_at: quote.expiresAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as FiatQuoteRow;
}

export async function getFiatQuoteForUser(userId: string, quoteId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("fiat_quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("privy_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as FiatQuoteRow | null;
}

export async function createFiatSessionRecord(input: {
  id: string;
  userId: string;
  quoteId: string;
  providerId: string;
  providerSessionId: string;
  status: string;
}) {
  const { data, error } = await getSupabaseAdmin()
    .from("fiat_sessions")
    .insert({
      id: input.id,
      privy_user_id: input.userId,
      quote_id: input.quoteId,
      provider_id: input.providerId,
      provider_session_id: input.providerSessionId,
      status: input.status,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as FiatSessionRow;
}

export async function getFiatSessionForUser(userId: string, sessionId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("fiat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("privy_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as FiatSessionRow | null;
}

export async function updateFiatSessionState(
  sessionId: string,
  state: FiatSessionState,
) {
  const { error } = await getSupabaseAdmin()
    .from("fiat_sessions")
    .update({
      status: state.status,
      source_amount: state.sourceAmount ?? null,
      destination_amount: state.destinationAmount ?? null,
      transaction_reference: state.transactionReference ?? null,
      completed_at: state.completedAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}
