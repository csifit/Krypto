import type { Beneficiary, LocalPaymentRecord } from "@/lib/payments/types";

const PREFIX = "krypto:v0.4";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function walletKey(wallet: `0x${string}`, kind: "beneficiaries" | "payments") {
  return `${PREFIX}:${wallet.toLowerCase()}:${kind}`;
}

export function loadBeneficiaries(wallet: `0x${string}`) {
  return readJson<Beneficiary[]>(walletKey(wallet, "beneficiaries"), []);
}

export function saveBeneficiaries(
  wallet: `0x${string}`,
  beneficiaries: Beneficiary[],
) {
  writeJson(walletKey(wallet, "beneficiaries"), beneficiaries);
}

export function loadPaymentHistory(wallet: `0x${string}`) {
  return readJson<LocalPaymentRecord[]>(walletKey(wallet, "payments"), []);
}

export function addPaymentRecord(
  wallet: `0x${string}`,
  record: LocalPaymentRecord,
) {
  const current = loadPaymentHistory(wallet);
  writeJson(walletKey(wallet, "payments"), [record, ...current].slice(0, 100));
}
