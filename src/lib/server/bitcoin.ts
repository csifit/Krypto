const MEMPOOL_API = "https://mempool.space/api";

export async function validateBitcoinAddress(address: string) {
  const response = await fetch(
    `${MEMPOOL_API}/v1/validate-address/${encodeURIComponent(address)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Bitcoin address validation is temporarily unavailable");
  }

  const result = (await response.json()) as { isvalid?: boolean };
  return result.isvalid === true;
}

type AddressStats = {
  funded_txo_sum: number;
  spent_txo_sum: number;
};

type AddressResponse = {
  chain_stats: AddressStats;
  mempool_stats: AddressStats;
};

function formatSats(sats: number) {
  const sign = sats < 0 ? "-" : "";
  const absolute = Math.abs(sats);
  const whole = Math.trunc(absolute / 100_000_000);
  const remainder = absolute % 100_000_000;
  return `${sign}${whole}.${remainder.toString().padStart(8, "0")}`;
}

export async function readBitcoinBalance(address: string) {
  const response = await fetch(
    `${MEMPOOL_API}/address/${encodeURIComponent(address)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    if (response.status === 400 || response.status === 404) {
      throw new Error("Invalid Bitcoin address");
    }
    throw new Error("Bitcoin balance is temporarily unavailable");
  }

  const data = (await response.json()) as AddressResponse;
  const confirmedSats = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
  const pendingSats = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
  const totalSats = confirmedSats + pendingSats;

  return {
    balance: formatSats(totalSats),
    confirmed: formatSats(confirmedSats),
    pending: formatSats(pendingSats),
    sats: totalSats,
  };
}
