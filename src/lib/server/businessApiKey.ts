import { createHash, randomBytes } from "node:crypto";
import type { BusinessApiKeyStatus } from "@/lib/business/apiKey";
import type { BusinessProfile } from "@/lib/business/profile";
import { requireSensitiveAction } from "@/lib/server/access";
import { getBusinessProfile } from "@/lib/server/businessProfile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export class BusinessApiAuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
    this.name = "BusinessApiAuthError";
  }
}

function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function keyEnvironment() {
  return process.env.NEXT_PUBLIC_KRYPTO_NETWORK === "mainnet"
    ? "live"
    : "test";
}

export async function getBusinessApiKeyStatus(
  userId: string,
): Promise<BusinessApiKeyStatus> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_api_keys")
    .select("key_prefix, created_at, last_used_at")
    .eq("privy_user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { active: false };

  return {
    active: true,
    prefix: data.key_prefix,
    createdAt: data.created_at,
    lastUsedAt: data.last_used_at ?? undefined,
  };
}

export async function rotateBusinessApiKey(userId: string) {
  await requireSensitiveAction(userId);

  const businessProfile = await getBusinessProfile(userId);
  if (!businessProfile) {
    throw new BusinessApiAuthError(
      "Create your Business profile before generating an API key.",
      409,
    );
  }

  const rawSecret = randomBytes(32).toString("base64url");
  const apiKey = `k121_${keyEnvironment()}_${rawSecret}`;
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = `${apiKey.slice(0, 20)}…`;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error: revokeError } = await supabase
    .from("business_api_keys")
    .update({ revoked_at: now })
    .eq("privy_user_id", userId)
    .is("revoked_at", null);

  if (revokeError) throw revokeError;

  const { data, error } = await supabase
    .from("business_api_keys")
    .insert({
      privy_user_id: userId,
      key_prefix: keyPrefix,
      key_hash: keyHash,
    })
    .select("key_prefix, created_at, last_used_at")
    .single();

  if (error) throw error;

  return {
    apiKey,
    status: {
      active: true,
      prefix: data.key_prefix,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at ?? undefined,
    } satisfies BusinessApiKeyStatus,
  };
}

export async function revokeBusinessApiKey(userId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("business_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("privy_user_id", userId)
    .is("revoked_at", null);

  if (error) throw error;
}

export async function requireBusinessApiKey(
  request: Request,
): Promise<{
  userId: string;
  businessProfile: BusinessProfile;
}> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token ||
    !token.startsWith("k121_")
  ) {
    throw new BusinessApiAuthError("Valid Krypto121 API key required.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_api_keys")
    .select("id, privy_user_id")
    .eq("key_hash", hashApiKey(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new BusinessApiAuthError("Invalid or revoked Krypto121 API key.");
  }

  await requireSensitiveAction(data.privy_user_id);

  const businessProfile = await getBusinessProfile(data.privy_user_id);
  if (!businessProfile) {
    throw new BusinessApiAuthError(
      "Business profile is required for API access.",
      403,
    );
  }

  await supabase
    .from("business_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    userId: data.privy_user_id,
    businessProfile,
  };
}
