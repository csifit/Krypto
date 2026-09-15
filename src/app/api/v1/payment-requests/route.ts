import {
  buildPaymentRequestLink,
  createPaymentRequest,
} from "@/lib/payments/paymentRequest";
import type { BusinessPaymentRequest } from "@/lib/payments/businessRequest";
import { AccessPolicyError } from "@/lib/server/access";
import {
  BusinessApiAuthError,
  requireBusinessApiKey,
} from "@/lib/server/businessApiKey";
import {
  TrackedPaymentRequestError,
  cancelTrackedPaymentRequestForUser,
  createTrackedPaymentRequestForUser,
  getTrackedPaymentRequestByExternalReference,
  getTrackedPaymentRequestForUser,
  listTrackedPaymentRequestsForUser,
} from "@/lib/server/paymentRequests";

export const runtime = "nodejs";

function withPaymentUrl(
  request: BusinessPaymentRequest,
  origin: string,
) {
  const link = buildPaymentRequestLink(
    origin,
    createPaymentRequest({
      recipient: request.recipient,
      asset: request.asset,
      amount: request.amount,
      memo: request.memo,
      requestId: request.id,
    }),
  );

  return {
    ...request,
    paymentUrl: link,
  };
}

function apiError(error: unknown) {
  if (
    error instanceof BusinessApiAuthError ||
    error instanceof AccessPolicyError ||
    error instanceof TrackedPaymentRequestError
  ) {
    return Response.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Business payment API failed", error);
  return Response.json(
    { error: "Krypto121 Business API request failed" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireBusinessApiKey(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const externalReference =
      url.searchParams.get("externalReference")?.trim();

    if (id) {
      const paymentRequest =
        await getTrackedPaymentRequestForUser(userId, id);

      if (!paymentRequest) {
        return Response.json(
          { error: "Payment request not found" },
          { status: 404 },
        );
      }

      return Response.json({
        request: withPaymentUrl(paymentRequest, url.origin),
      });
    }

    if (externalReference) {
      const paymentRequest =
        await getTrackedPaymentRequestByExternalReference(
          userId,
          externalReference,
        );

      if (!paymentRequest) {
        return Response.json(
          { error: "Payment request not found" },
          { status: 404 },
        );
      }

      return Response.json({
        request: withPaymentUrl(paymentRequest, url.origin),
      });
    }

    const paymentRequests =
      await listTrackedPaymentRequestsForUser(userId, 50);

    return Response.json({
      requests: paymentRequests.map((item) =>
        withPaymentUrl(item, url.origin),
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId, businessProfile } =
      await requireBusinessApiKey(request);

    const body = (await request.json()) as {
      amount?: string;
      memo?: string;
      recipient?: string;
      asset?: string;
      externalReference?: string;
    };

    const recipient =
      body.recipient?.trim() ||
      businessProfile.defaultReceiveWallet;

    const asset =
      body.asset?.trim() ||
      businessProfile.defaultReceiveAsset;

    if (!recipient) {
      throw new TrackedPaymentRequestError(
        "recipient is required because no default receive wallet is configured",
      );
    }

    if (!asset) {
      throw new TrackedPaymentRequestError(
        "asset is required because no default receive asset is configured",
      );
    }

    const created =
      await createTrackedPaymentRequestForUser({
        userId,
        recipient,
        assetSymbol: asset,
        amount: body.amount ?? "",
        memo: body.memo,
        externalReference: body.externalReference,
      });

    return Response.json(
      {
        request: withPaymentUrl(
          created.request,
          new URL(request.url).origin,
        ),
        reused: created.reused,
      },
      { status: created.reused ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireBusinessApiKey(request);

    const body = (await request.json()) as {
      id?: string;
      action?: "cancel";
    };

    if (!body.id || body.action !== "cancel") {
      throw new TrackedPaymentRequestError(
        "id and action=cancel are required",
      );
    }

    const paymentRequest =
      await cancelTrackedPaymentRequestForUser(
        userId,
        body.id,
      );

    return Response.json({
      request: withPaymentUrl(
        paymentRequest,
        new URL(request.url).origin,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
