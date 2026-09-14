"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";
import { checkDirectTransferPreflight } from "@/lib/blockchain/usdt";

export type ReadinessState = "waiting" | "checking" | "ready" | "blocked";

export type ReadinessItem = {
  state: ReadinessState;
  label: string;
  detail: string;
};

function item(state: ReadinessState, label: string, detail: string): ReadinessItem {
  return { state, label, detail };
}

export function usePaymentReadiness(input: {
  sourceAddress?: `0x${string}`;
  sourceBalance: string;
  sourceBalanceLoading: boolean;
  sourceBalanceError: string | null;
  recipient: string;
  amount: string;
}) {
  const { sourceAddress, sourceBalance, sourceBalanceLoading, sourceBalanceError, recipient, amount } = input;

  const recipientReady = Boolean(recipient && isAddress(recipient));
  const numericAmount = Number(amount);
  const amountValid = Boolean(amount) && Number.isFinite(numericAmount) && numericAmount > 0;

  const fundsReady =
    Boolean(sourceAddress) &&
    amountValid &&
    !sourceBalanceLoading &&
    !sourceBalanceError &&
    numericAmount <= Number(sourceBalance);

  const [networkState, setNetworkState] = useState<ReadinessItem>(
    item("waiting", "Network fees", "Complete the payment details first"),
  );
  const [routeState, setRouteState] = useState<ReadinessItem>(
    item("waiting", "Route", "Complete the payment details first"),
  );

  useEffect(() => {
    if (!sourceAddress || !recipientReady || !amountValid || !fundsReady) {
      setNetworkState(item("waiting", "Network fees", "Complete the payment details first"));
      setRouteState(item("waiting", "Route", "Complete the payment details first"));
      return;
    }

    let cancelled = false;
    setNetworkState(item("checking", "Network fees", "Checking"));
    setRouteState(item("checking", "Route", "Checking"));

    void checkDirectTransferPreflight({
      sourceWallet: sourceAddress,
      recipient: recipient as `0x${string}`,
      amount,
    }).then((result) => {
      if (cancelled) return;

      if (!result.routeAvailable) {
        setNetworkState(item("blocked", "Network fees", "Could not verify fee readiness"));
        setRouteState(item("blocked", "Route", result.error ?? "Route unavailable"));
        return;
      }

      setRouteState(item("ready", "Route", "Available"));
      setNetworkState(
        result.networkFeeReady
          ? item("ready", "Network fees", "Ready")
          : item("blocked", "Network fees", "Action required before sending"),
      );
    });

    return () => { cancelled = true; };
  }, [sourceAddress, recipient, recipientReady, amount, amountValid, fundsReady]);

  const recipientState = useMemo<ReadinessItem>(() => {
    if (!recipient) return item("waiting", "Recipient", "Enter a wallet address");
    if (!recipientReady) return item("blocked", "Recipient", "Invalid wallet address");
    return item("ready", "Recipient", "Ready");
  }, [recipient, recipientReady]);

  const fundsState = useMemo<ReadinessItem>(() => {
    if (!sourceAddress) return item("waiting", "Funds", "Connect a source wallet");
    if (!amount) return item("waiting", "Funds", "Enter an amount");
    if (!amountValid) return item("blocked", "Funds", "Enter a valid amount");
    if (sourceBalanceLoading) return item("checking", "Funds", "Checking balance");
    if (sourceBalanceError) return item("blocked", "Funds", "Balance unavailable");
    if (numericAmount > Number(sourceBalance)) return item("blocked", "Funds", "Insufficient balance");
    return item("ready", "Funds", "Ready");
  }, [sourceAddress, amount, amountValid, sourceBalanceLoading, sourceBalanceError, numericAmount, sourceBalance]);

  const ready =
    recipientState.state === "ready" &&
    fundsState.state === "ready" &&
    networkState.state === "ready" &&
    routeState.state === "ready";

  const checking =
    fundsState.state === "checking" ||
    networkState.state === "checking" ||
    routeState.state === "checking";

  return { recipient: recipientState, funds: fundsState, network: networkState, route: routeState, ready, checking };
}
