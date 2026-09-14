import type {
  Beneficiary,
  LocalPaymentRecord,
} from "@/lib/payments/types";
import type { WatchWallet } from "@/lib/wallet/directory";

type AccessTokenGetter = () => Promise<string | null>;

async function authedRequest<T>(
  getAccessToken: AccessTokenGetter,
  input: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Your session expired. Please log in again.");

  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(input, {
    ...init,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(body.error || "Krypto121 backend request failed");
  }

  return body;
}

export async function syncProfile(
  getAccessToken: AccessTokenGetter,
  walletAddress: `0x${string}`,
) {
  return authedRequest<{ profile: unknown }>(getAccessToken, "/api/profile", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });
}

export async function listBeneficiaries(getAccessToken: AccessTokenGetter) {
  const result = await authedRequest<{ beneficiaries: Beneficiary[] }>(
    getAccessToken,
    "/api/beneficiaries",
  );
  return result.beneficiaries;
}

export async function createBeneficiary(
  getAccessToken: AccessTokenGetter,
  input: { name: string; address: `0x${string}`; walletAddress: `0x${string}` },
) {
  const result = await authedRequest<{ beneficiary: Beneficiary }>(
    getAccessToken,
    "/api/beneficiaries",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return result.beneficiary;
}

export async function deleteBeneficiary(
  getAccessToken: AccessTokenGetter,
  id: string,
) {
  await authedRequest<{ ok: true }>(
    getAccessToken,
    `/api/beneficiaries?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function listPayments(getAccessToken: AccessTokenGetter) {
  const result = await authedRequest<{ payments: LocalPaymentRecord[] }>(
    getAccessToken,
    "/api/payments",
  );
  return result.payments;
}

export async function savePaymentRecord(
  getAccessToken: AccessTokenGetter,
  walletAddress: `0x${string}`,
  record: LocalPaymentRecord,
) {
  await authedRequest<{ ok: true }>(getAccessToken, "/api/payments", {
    method: "POST",
    body: JSON.stringify({ walletAddress, record }),
  });
}


export async function listWatchWallets(getAccessToken: AccessTokenGetter) {
  const result = await authedRequest<{ watchWallets: WatchWallet[] }>(
    getAccessToken,
    "/api/watch-wallets",
  );
  return result.watchWallets;
}

export async function createWatchWallet(
  getAccessToken: AccessTokenGetter,
  input: { label: string; address: `0x${string}` },
) {
  const result = await authedRequest<{ watchWallet: WatchWallet }>(
    getAccessToken,
    "/api/watch-wallets",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return result.watchWallet;
}

export async function deleteWatchWallet(
  getAccessToken: AccessTokenGetter,
  id: string,
) {
  await authedRequest<{ ok: true }>(
    getAccessToken,
    `/api/watch-wallets?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
