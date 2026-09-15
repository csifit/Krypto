import type {
  Beneficiary,
  LocalPaymentRecord,
} from "@/lib/payments/types";
import type { WalletLabel, WatchWallet } from "@/lib/wallet/directory";

type AccessTokenGetter = () => Promise<string | null>;
export type AccountProfileSummary = {
  id: string;
  privyUserId: string;
  walletAddress?: string;
  email?: string;
  role: "user" | "super_admin";
  accountStatus: "active" | "suspended" | "blocked";
  statusReason?: string;
  statusChangedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminOverview = {
  settings: {
    paymentsEnabled: boolean;
    mainnetPaymentsEnabled: boolean;
    maxPaymentAmount?: string;
    updatedAt: string;
    updatedBy?: string;
  };
  rpcHealth: Array<{
    role: "primary" | "secondary";
    configured: boolean;
    healthy: boolean;
    latencyMs?: number;
    blockNumber?: string;
    error?: string;
  }>;
  users: Array<{
    privyUserId: string;
    email?: string;
    walletAddress?: string;
    role: "user" | "super_admin";
    accountStatus: "active" | "suspended" | "blocked";
    statusReason?: string;
    statusChangedAt?: string;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    actorUserId: string;
    action: string;
    targetUserId?: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
};


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
  return authedRequest<{ profile: AccountProfileSummary }>(getAccessToken, "/api/profile", {
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
  accountWalletAddress: `0x${string}`,
  record: LocalPaymentRecord,
) {
  await authedRequest<{ ok: true }>(getAccessToken, "/api/payments", {
    method: "POST",
    body: JSON.stringify({ walletAddress: accountWalletAddress, record }),
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
  input: { label: string; address: string; chainType: "ethereum" | "bitcoin" },
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


export async function listWalletLabels(getAccessToken: AccessTokenGetter) {
  const result = await authedRequest<{ walletLabels: WalletLabel[] }>(
    getAccessToken,
    "/api/wallet-labels",
  );
  return result.walletLabels;
}

export async function saveWalletLabel(
  getAccessToken: AccessTokenGetter,
  input: { address: `0x${string}`; label: string },
) {
  const result = await authedRequest<{ walletLabel: WalletLabel }>(
    getAccessToken,
    "/api/wallet-labels",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return result.walletLabel;
}

export async function deleteWalletLabel(
  getAccessToken: AccessTokenGetter,
  address: `0x${string}`,
) {
  await authedRequest<{ ok: true }>(
    getAccessToken,
    `/api/wallet-labels?address=${encodeURIComponent(address)}`,
    { method: "DELETE" },
  );
}


export async function readBitcoinWatchBalance(
  getAccessToken: AccessTokenGetter,
  address: string,
) {
  return authedRequest<{
    balance: string;
    confirmed: string;
    pending: string;
  }>(
    getAccessToken,
    `/api/bitcoin/balance?address=${encodeURIComponent(address)}`,
  );
}

export async function authorizePayment(
  getAccessToken: AccessTokenGetter,
  input: {
    accountWalletAddress: `0x${string}`;
    sourceWallet: `0x${string}`;
    amount: string;
    network: "celo-sepolia" | "celo";
  },
) {
  return authedRequest<{ authorized: true }>(
    getAccessToken,
    "/api/payments/authorize",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function getAdminOverview(getAccessToken: AccessTokenGetter) {
  return authedRequest<AdminOverview>(getAccessToken, "/api/admin/overview");
}

export async function updateAdminSettings(
  getAccessToken: AccessTokenGetter,
  input: {
    paymentsEnabled: boolean;
    mainnetPaymentsEnabled: boolean;
    maxPaymentAmount: string | null;
  },
) {
  return authedRequest<{ ok: true }>(getAccessToken, "/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function updateAdminUserStatus(
  getAccessToken: AccessTokenGetter,
  input: {
    targetUserId: string;
    status: "active" | "suspended" | "blocked";
    reason?: string;
  },
) {
  return authedRequest<{ ok: true }>(getAccessToken, "/api/admin/user-status", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

