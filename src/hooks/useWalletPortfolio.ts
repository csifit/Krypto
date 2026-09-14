"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readCeloBalance, readUsdtBalance } from "@/lib/blockchain/usdt";

export type WalletBalanceSnapshot = {
  address: `0x${string}`;
  usdt: string;
  celo: string;
  error: string | null;
};

function dedupeAddresses(addresses: `0x${string}`[]) {
  const seen = new Set<string>();
  const unique: `0x${string}`[] = [];

  for (const address of addresses) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(address);
  }

  return unique;
}

export function useWalletPortfolio(addresses: `0x${string}`[]) {
  const addressKey = addresses.map((address) => address.toLowerCase()).sort().join("|");
  const normalizedAddresses = useMemo(
    () => dedupeAddresses(addresses),
    // addressKey intentionally captures the address set, not array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addressKey],
  );

  const [balances, setBalances] = useState<Record<string, WalletBalanceSnapshot>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (normalizedAddresses.length === 0) {
      setBalances({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const results = await Promise.all(
      normalizedAddresses.map(async (address): Promise<WalletBalanceSnapshot> => {
        try {
          const [usdt, celo] = await Promise.all([
            readUsdtBalance(address),
            readCeloBalance(address),
          ]);

          return {
            address,
            usdt: usdt.formatted,
            celo: celo.formatted,
            error: null,
          };
        } catch (error) {
          return {
            address,
            usdt: "0",
            celo: "0",
            error: error instanceof Error ? error.message : "Could not read wallet balances",
          };
        }
      }),
    );

    const next: Record<string, WalletBalanceSnapshot> = {};
    for (const result of results) {
      next[result.address.toLowerCase()] = result;
    }

    setBalances(next);
    setLoading(false);
  }, [normalizedAddresses]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balances, loading, refresh };
}
