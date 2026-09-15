import { AccessPolicyError } from "@/lib/server/access";
import {
  AdminElevationError,
  createAdminElevationChallenge,
} from "@/lib/server/adminElevation";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    const challenge = await createAdminElevationChallenge(userId);
    return Response.json(challenge);
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
    console.error("admin elevation challenge failed", error);
    return Response.json(
      { error: "Could not start privileged verification" },
      { status: 500 },
    );
  }
}
