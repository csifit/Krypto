"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readBitcoinWatchBalance } from "@/lib/backend/client";

export type BitcoinBalanceSnapshot = {
  address: string;
  balance: string;
  confirmed: string;
  pending: string;
  error: string | null;
};

type AccessTokenGetter = () => Promise<string | null>;

function dedupe(addresses: string[]) {
  return Array.from(new Set(addresses));
}

export function useBitcoinPortfolio(
  addresses: string[],
  getAccessToken: AccessTokenGetter,
) {
  const addressKey = addresses.slice().sort().join("|");
  const normalized = useMemo(
    () => dedupe(addresses),
    // addressKey captures content rather than array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addressKey],
  );

  const [balances, setBalances] = useState<Record<string, BitcoinBalanceSnapshot>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!normalized.length) {
      setBalances({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const results = await Promise.all(
      normalized.map(async (address): Promise<BitcoinBalanceSnapshot> => {
        try {
          const result = await readBitcoinWatchBalance(getAccessToken, address);
          return { address, ...result, error: null };
        } catch (error) {
          return {
            address,
            balance: "0.00000000",
            confirmed: "0.00000000",
            pending: "0.00000000",
            error: error instanceof Error ? error.message : "Could not read Bitcoin balance",
          };
        }
      }),
    );

    const next: Record<string, BitcoinBalanceSnapshot> = {};
    for (const result of results) next[result.address] = result;
    setBalances(next);
    setLoading(false);
  }, [getAccessToken, normalized]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { balances, loading, refresh };
}
