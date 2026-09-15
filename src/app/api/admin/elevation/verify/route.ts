import { NextResponse } from "next/server";
import { AccessPolicyError } from "@/lib/server/access";
import {
  ADMIN_ELEVATION_COOKIE,
  AdminElevationError,
  verifyAdminElevationChallenge,
} from "@/lib/server/adminElevation";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const body = (await request.json()) as {
      challengeId?: string;
      signature?: string;
    };

    if (!body.challengeId || !body.signature) {
      return Response.json(
        { error: "Challenge and signature are required" },
        { status: 400 },
      );
    }

    const elevated = await verifyAdminElevationChallenge({
      userId,
      challengeId: body.challengeId,
      signature: body.signature,
    });

    const response = NextResponse.json({
      elevated: true,
      elevatedUntil: elevated.expiresAt,
    });

    response.cookies.set({
      name: ADMIN_ELEVATION_COOKIE,
      value: elevated.sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin",
      expires: new Date(elevated.expiresAt),
    });

    return response;
  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof AccessPolicyError ||
      error instanceof AdminElevationError
    ) {
      return Response.json(
        {
          error: error.message,
          code:
            error instanceof AdminElevationError ? error.code : undefined,
        },
        { status: error.status },
      );
    }
    console.error("admin elevation verify failed", error);
    return Response.json(
      { error: "Could not verify privileged access" },
      { status: 500 },
    );
  }
}
