"use client";

import { useState } from "react";
import { mintTestUsdt } from "@/lib/blockchain/usdt";
import type { WalletProvider } from "@/lib/wallet/types";

export default function TestFundsPanel({
  wallet,
  celoBalance,
  onFunded,
}: {
  wallet: WalletProvider;
  celoBalance: string;
  onFunded(): Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "minting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  async function mint() {
    setStatus("minting");
    setError(null);
    setHash(null);

    try {
      const txHash = await mintTestUsdt(wallet, "100");
      setHash(txHash);
      setStatus("success");
      await onFunded();
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof Error
          ? err.message
          : "Could not approve the development transaction",
      );
    }
  }

  const hasCelo = Number(celoBalance) > 0;

  return (
    <section className="panel testFundsPanel">
      <span className="status">Development only</span>
      <h2>Test funds</h2>
      <p>
        Add test CELO for gas, then approve a development-only transaction that
        adds 100 USDTd to this wallet. USDTd has no real-world value.
      </p>

      <div className="fundingStatus">
        <div>
          <span className="miniLabel">Gas balance</span>
          <strong>{Number(celoBalance).toFixed(4)} CELO</strong>
        </div>
      </div>

      <div className="actions">
        <a
          className="secondaryButton buttonLink"
          href="https://faucet.celo.org/celo-sepolia"
          target="_blank"
          rel="noreferrer"
        >
          Get test CELO
        </a>
        <button
          className="primaryButton"
          onClick={() => void mint()}
          disabled={status === "minting" || !hasCelo}
        >
          {status === "minting" ? "Waiting for approval…" : "Approve transaction"}
        </button>
      </div>

      {!hasCelo ? (
        <p className="hint">Get test CELO first, then refresh your balance.</p>
      ) : null}

      {error ? <p className="errorText">{error}</p> : null}

      {status === "success" && hash ? (
        <p className="successText">
          Test transaction approved. 100 USDTd added.{" "}
          <a
            className="inlineLink inlineLinkNoMargin"
            href={`https://celo-sepolia.blockscout.com/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        </p>
      ) : null}
    </section>
  );
}
