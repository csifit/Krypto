import { getAccountProfile } from "@/lib/server/profile";

export class AccessPolicyError extends Error {
  constructor(message: string, public readonly status = 403) {
    super(message);
    this.name = "AccessPolicyError";
  }
}

export async function requireSensitiveAction(userId: string) {
  const profile = await getAccountProfile(userId);

  if (profile.accountStatus === "suspended") {
    throw new AccessPolicyError(
      profile.statusReason
        ? `This Krypto121 account is suspended: ${profile.statusReason}`
        : "This Krypto121 account is suspended.",
    );
  }

  if (profile.accountStatus === "blocked") {
    throw new AccessPolicyError(
      profile.statusReason
        ? `This Krypto121 account is blocked: ${profile.statusReason}`
        : "This Krypto121 account is blocked.",
    );
  }

  return profile;
}

export async function requireSuperAdmin(userId: string) {
  const profile = await requireSensitiveAction(userId);

  if (profile.role !== "super_admin") {
    throw new AccessPolicyError("Super admin access required.");
  }

  return profile;
}
