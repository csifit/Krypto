import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isAddress, verifyMessage, type Hex } from "viem";
import { requireSuperAdmin } from "@/lib/server/access";
import {
  getPrivyLinkedEvmAddresses,
  getPrivyUserMfaMethods,
  requirePrivyUser,
} from "@/lib/server/privy";
import { writeAdminAudit } from "@/lib/server/operations";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const ADMIN_ELEVATION_COOKIE = "krypto_admin_elevation";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000;

export class AdminElevationError extends Error {
  constructor(
    message: string,
    public readonly status = 428,
    public readonly code = "ADMIN_ELEVATION_REQUIRED",
  ) {
    super(message);
    this.name = "AdminElevationError";
  }
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

async function requireAdminMfaEnrollment(userId: string) {
  const methods = await getPrivyUserMfaMethods(userId);
  if (!methods.length) {
    throw new AdminElevationError(
      "Super-admin MFA enrollment is required before privileged access.",
      428,
      "ADMIN_MFA_REQUIRED",
    );
  }
  return methods;
}

export async function createAdminElevationChallenge(userId: string) {
  const profile = await requireSuperAdmin(userId);
  await requireAdminMfaEnrollment(userId);

  if (!profile.walletAddress || !isAddress(profile.walletAddress)) {
    throw new AdminElevationError(
      "A Krypto121 embedded wallet must be synced before privileged access can be verified.",
      409,
      "ADMIN_WALLET_REQUIRED",
    );
  }

  const linkedWallets = await getPrivyLinkedEvmAddresses(userId);
  if (!linkedWallets.has(profile.walletAddress.toLowerCase())) {
    throw new AdminElevationError(
      "The admin wallet is no longer linked to this Privy account.",
      403,
      "ADMIN_WALLET_NOT_LINKED",
    );
  }

  const challengeId = randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const message = [
    "Krypto121 privileged admin access",
    "",
    `Admin: ${userId}`,
    `Challenge: ${challengeId}`,
    `Expires: ${expiresAt}`,
    "",
    "This signature unlocks Krypto121 administrative controls only.",
    "It does not authorize a payment or transfer funds.",
  ].join("\n");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("admin_elevation_challenges").insert({
    id: challengeId,
    privy_user_id: userId,
    wallet_address: profile.walletAddress,
    challenge_message: message,
    expires_at: expiresAt,
  });

  if (error) throw error;

  return {
    challengeId,
    message,
    walletAddress: profile.walletAddress as `0x${string}`,
    expiresAt,
  };
}

export async function verifyAdminElevationChallenge(input: {
  userId: string;
  challengeId: string;
  signature: string;
}) {
  await requireSuperAdmin(input.userId);
  await requireAdminMfaEnrollment(input.userId);

  if (!/^[0-9a-fA-F-]{36}$/.test(input.challengeId)) {
    throw new AdminElevationError(
      "Invalid privileged-access challenge.",
      400,
      "ADMIN_CHALLENGE_INVALID",
    );
  }

  if (!/^0x[0-9a-fA-F]+$/.test(input.signature)) {
    throw new AdminElevationError(
      "Invalid admin wallet signature.",
      400,
      "ADMIN_SIGNATURE_INVALID",
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: challenge, error } = await supabase
    .from("admin_elevation_challenges")
    .select(
      "id, privy_user_id, wallet_address, challenge_message, expires_at, used_at",
    )
    .eq("id", input.challengeId)
    .eq("privy_user_id", input.userId)
    .maybeSingle();

  if (error) throw error;
  if (!challenge) {
    throw new AdminElevationError(
      "Privileged-access challenge not found.",
      404,
      "ADMIN_CHALLENGE_NOT_FOUND",
    );
  }

  if (challenge.used_at) {
    throw new AdminElevationError(
      "This privileged-access challenge has already been used.",
      409,
      "ADMIN_CHALLENGE_USED",
    );
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    throw new AdminElevationError(
      "This privileged-access challenge expired. Try again.",
      410,
      "ADMIN_CHALLENGE_EXPIRED",
    );
  }

  const valid = await verifyMessage({
    address: challenge.wallet_address as `0x${string}`,
    message: challenge.challenge_message,
    signature: input.signature as Hex,
  });

  if (!valid) {
    throw new AdminElevationError(
      "Admin wallet signature could not be verified.",
      403,
      "ADMIN_SIGNATURE_INVALID",
    );
  }

  const usedAt = new Date().toISOString();
  const { data: consumed, error: consumeError } = await supabase
    .from("admin_elevation_challenges")
    .update({ used_at: usedAt })
    .eq("id", challenge.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError) throw consumeError;
  if (!consumed) {
    throw new AdminElevationError(
      "This privileged-access challenge has already been used.",
      409,
      "ADMIN_CHALLENGE_USED",
    );
  }

  const sessionToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error: sessionError } = await supabase
    .from("admin_elevated_sessions")
    .insert({
      privy_user_id: input.userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (sessionError) throw sessionError;

  await writeAdminAudit({
    actorUserId: input.userId,
    action: "admin.privileged_access.unlocked",
    details: { expiresAt },
  });

  return { sessionToken, expiresAt };
}

export async function requireElevatedSuperAdmin(request: Request) {
  const { userId } = await requirePrivyUser(request);
  const profile = await requireSuperAdmin(userId);
  const token = readCookie(request, ADMIN_ELEVATION_COOKIE);

  if (!token) {
    throw new AdminElevationError(
      "Privileged admin verification required.",
      428,
      "ADMIN_ELEVATION_REQUIRED",
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: session, error } = await supabase
    .from("admin_elevated_sessions")
    .select("id, expires_at")
    .eq("privy_user_id", userId)
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!session) {
    throw new AdminElevationError(
      "Privileged admin verification expired. Verify again.",
      428,
      "ADMIN_ELEVATION_REQUIRED",
    );
  }

  return {
    userId,
    profile,
    elevatedUntil: session.expires_at as string,
  };
}

export async function revokeAdminElevation(request: Request, userId: string) {
  const token = readCookie(request, ADMIN_ELEVATION_COOKIE);
  if (!token) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("admin_elevated_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("privy_user_id", userId)
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null);

  if (error) throw error;

  await writeAdminAudit({
    actorUserId: userId,
    action: "admin.privileged_access.locked",
  });
}
