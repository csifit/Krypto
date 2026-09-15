import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import {
  TrackedPaymentRequestError,
  cancelTrackedPaymentRequestForUser,
  createTrackedPaymentRequestForUser,
  listTrackedPaymentRequestsForUser,
} from "@/lib/server/paymentRequests";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);

    return Response.json({
      requests: await listTrackedPaymentRequestsForUser(userId),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("payment request list failed", error);
    return Response.json(
      { error: "Could not load payment requests" },
      { status: 500 },
    );
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
      externalReference?: string;
    };

    const created = await createTrackedPaymentRequestForUser({
      userId,
      recipient: body.recipient ?? "",
      assetSymbol: body.asset ?? "",
      amount: body.amount ?? "",
      memo: body.memo,
      externalReference: body.externalReference,
    });

    return Response.json(
      { request: created.request },
      { status: created.reused ? 200 : 201 },
    );
  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof AccessPolicyError ||
      error instanceof TrackedPaymentRequestError
    ) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("payment request create failed", error);
    return Response.json(
      { error: "Could not create tracked payment request" },
      { status: 500 },
    );
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
      return Response.json(
        { error: "Invalid payment request action" },
        { status: 400 },
      );
    }

    return Response.json({
      request: await cancelTrackedPaymentRequestForUser(
        userId,
        body.id,
      ),
    });
  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof AccessPolicyError ||
      error instanceof TrackedPaymentRequestError
    ) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("payment request cancel failed", error);
    return Response.json(
      { error: "Could not cancel payment request" },
      { status: 500 },
    );
  }
}
