"use client";

import { useCallback, useEffect, useState } from "react";
import { readStablecoinBalance } from "@/lib/blockchain/usdt";
import type { SupportedStablecoin } from "@/lib/assets";

export function useStablecoinBalance(
  address: `0x${string}` | undefined,
  asset: SupportedStablecoin,
) {
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setBalance("0");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await readStablecoinBalance(address, asset);
      setBalance(result.formatted);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not read ${asset.symbol} balance`,
      );
    } finally {
      setLoading(false);
    }
  }, [address, asset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}
