import { PrivyClient } from "@privy-io/node";
import { isAddress } from "viem";

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

type PrivyLinkedAccountLike = {
  type?: string;
  address?: string;
  email?: string;
};

type PrivyMfaMethodLike = string | { type?: string; method?: string };

type PrivyUserLike = {
  linked_accounts?: PrivyLinkedAccountLike[];
  linkedAccounts?: PrivyLinkedAccountLike[];
  email?: string | { address?: string };
  mfa_methods?: PrivyMfaMethodLike[];
  mfaMethods?: PrivyMfaMethodLike[];
};

async function getPrivyUser(userId: string) {
  return (await getPrivyClient().users()._get(userId)) as unknown as PrivyUserLike;
}

export async function getPrivyLinkedEvmAddresses(userId: string) {
  const user = await getPrivyUser(userId);
  const accounts = user.linked_accounts ?? user.linkedAccounts ?? [];

  return new Set(
    accounts
      .map((account) => account.address)
      .filter((address): address is string => Boolean(address && isAddress(address)))
      .map((address) => address.toLowerCase()),
  );
}

export async function getPrivyUserMfaMethods(userId: string) {
  const user = await getPrivyUser(userId);
  const methods = user.mfa_methods ?? user.mfaMethods ?? [];

  return methods
    .map((method) => {
      if (typeof method === "string") return method;
      return method.type ?? method.method ?? null;
    })
    .filter((method): method is string => Boolean(method));
}

export async function getPrivyUserEmail(userId: string) {
  const user = await getPrivyUser(userId);

  if (typeof user.email === "string" && user.email.includes("@")) {
    return user.email;
  }

  if (
    user.email &&
    typeof user.email === "object" &&
    typeof user.email.address === "string" &&
    user.email.address.includes("@")
  ) {
    return user.email.address;
  }

  const accounts = user.linked_accounts ?? user.linkedAccounts ?? [];
  const emailAccount = accounts.find(
    (account) =>
      account.type === "email" &&
      typeof account.address === "string" &&
      account.address.includes("@"),
  );

  return emailAccount?.address ?? null;
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
