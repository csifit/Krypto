import { PrivyClient } from "@privy-io/node";

let privyClient: PrivyClient | null = null;

function getPrivyClient() {
  if (privyClient) return privyClient;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not configured");
  if (!appSecret) throw new Error("PRIVY_APP_SECRET is not configured");

  privyClient = new PrivyClient({ appId, appSecret });
  return privyClient;
}

export async function requirePrivyUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1];

  if (!accessToken) {
    throw new AuthError("Missing Privy access token", 401);
  }

  try {
    const claims = await getPrivyClient()
      .utils()
      .auth()
      .verifyAccessToken(accessToken);

    if (!claims.user_id) {
      throw new AuthError("Invalid Privy access token", 401);
    }

    return { userId: claims.user_id };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Invalid or expired Privy access token", 401);
  }
}

export class AuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AuthError";
  }
}
