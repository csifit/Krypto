import { AccessPolicyError } from "@/lib/server/access";
import {
  BusinessApiAuthError,
  getBusinessApiKeyStatus,
  revokeBusinessApiKey,
  rotateBusinessApiKey,
} from "@/lib/server/businessApiKey";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    return Response.json({
      status: await getBusinessApiKeyStatus(userId),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("business api key status failed", error);
    return Response.json(
      { error: "Could not load Business API key status" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    return Response.json(await rotateBusinessApiKey(userId));
  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof AccessPolicyError ||
      error instanceof BusinessApiAuthError
    ) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("business api key generation failed", error);
    return Response.json(
      { error: "Could not generate Business API key" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await revokeBusinessApiKey(userId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("business api key revoke failed", error);
    return Response.json(
      { error: "Could not revoke Business API key" },
      { status: 500 },
    );
  }
}
