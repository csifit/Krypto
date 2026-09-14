"use client";

import { useCallback, useEffect, useState } from "react";
import { readCeloBalance } from "@/lib/blockchain/usdt";

export function useCeloBalance(address?: `0x${string}`) {
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setBalance("0");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await readCeloBalance(address);
      setBalance(result.formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read CELO balance");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}
