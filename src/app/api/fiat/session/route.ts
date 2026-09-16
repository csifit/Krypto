import { randomUUID } from "node:crypto";
import { ipAddress } from "@vercel/functions";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { getConfiguredFiatProvider } from "@/lib/server/fiatProviders";
import {
  createFiatSessionRecord,
  getFiatQuoteForUser,
  getFiatSessionForUser,
  updateFiatSessionState,
} from "@/lib/server/fiatQuotes";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as { quoteId?: string };
    if (!body.quoteId) {
      return Response.json(
        { error: "Missing fiat quote" },
        { status: 400 },
      );
    }

    const savedQuote = await getFiatQuoteForUser(userId, body.quoteId);
    if (!savedQuote) {
      return Response.json(
        { error: "Fiat quote not found" },
        { status: 404 },
      );
    }

    if (new Date(savedQuote.expires_at).getTime() <= Date.now()) {
      return Response.json(
        { error: "This quote expired. Review again." },
        { status: 409 },
      );
    }

    const provider = getConfiguredFiatProvider(savedQuote.provider_id);
    if (!provider) {
      return Response.json(
        { error: "The selected fiat provider is unavailable" },
        { status: 503 },
      );
    }

    const clientIp = ipAddress(request);
    if (!clientIp) {
      return Response.json(
        { error: "Could not verify the request network location" },
        { status: 400 },
      );
    }

    const internalSessionId = randomUUID();
    const origin = new URL(request.url).origin;
    const redirectUrl =
      `${origin}/fiat?session=${encodeURIComponent(internalSessionId)}`;

    const providerSession = await provider.createSession({
      quote: savedQuote.quote_payload,
      request: {
        ...savedQuote.request_payload,
        clientIp,
      },
      partnerUserId: userId,
      redirectUrl,
    });

    await createFiatSessionRecord({
      id: internalSessionId,
      userId,
      quoteId: savedQuote.id,
      providerId: provider.id,
      providerSessionId: providerSession.providerSessionId,
      status: providerSession.status,
    });

    if (!providerSession.url) {
      return Response.json(
        { error: "The fiat provider did not return a checkout link" },
        { status: 502 },
      );
    }

    return Response.json({
      sessionId: internalSessionId,
      url: providerSession.url,
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("fiat session creation failed", error);
    return Response.json(
      { error: "Could not start the fiat checkout" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("id");

    if (!sessionId) {
      return Response.json(
        { error: "Missing fiat session" },
        { status: 400 },
      );
    }

    const session = await getFiatSessionForUser(userId, sessionId);
    if (!session) {
      return Response.json(
        { error: "Fiat session not found" },
        { status: 404 },
      );
    }

    const provider = getConfiguredFiatProvider(session.provider_id);
    if (!provider) {
      return Response.json(
        { error: "The fiat provider is unavailable" },
        { status: 503 },
      );
    }

    const state = await provider.getStatus(session.provider_session_id);
    await updateFiatSessionState(session.id, state);

    return Response.json({
      session: {
        id: session.id,
        providerName: provider.displayName,
        status: state.status,
        sourceAmount: state.sourceAmount,
        destinationAmount: state.destinationAmount,
        transactionReference: state.transactionReference,
        completedAt: state.completedAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("fiat session status failed", error);
    return Response.json(
      { error: "Could not read fiat transaction status" },
      { status: 500 },
    );
  }
}
