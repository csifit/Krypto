"use client";

import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { sendTestUsdt } from "@/lib/blockchain/usdt";
import type { WalletProvider } from "@/lib/wallet/types";

export default function SendPanel({
  wallet,
  balance,
  onSent,
}: {
  wallet: WalletProvider;
  balance: string;
  onSent(): Promise<void>;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<"form" | "review" | "sending" | "success">(
    "form",
  );
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const validationError = useMemo(() => {
    if (!recipient || !amount) return null;
    if (!isAddress(recipient)) return "Enter a valid Celo/EVM wallet address";

    const number = Number(amount);
    if (!Number.isFinite(number) || number <= 0) {
      return "Amount must be greater than zero";
    }
    if (number > Number(balance)) return "Amount exceeds your test balance";
    return null;
  }, [recipient, amount, balance]);

  function review() {
    setError(null);

    if (!recipient || !amount) {
      setError("Enter a recipient and amount");
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }

    setStage("review");
  }

  async function confirm() {
    setStage("sending");
    setError(null);

    try {
      const txHash = await sendTestUsdt(wallet, recipient, amount);
      setHash(txHash);
      setStage("success");
      await onSent();
    } catch (err) {
      setStage("review");
      setError(err instanceof Error ? err.message : "Could not send test USDT");
    }
  }

  function reset() {
    setRecipient("");
    setAmount("");
    setError(null);
    setHash(null);
    setStage("form");
  }

  if (stage === "success" && hash) {
    return (
      <section className="sendPanel">
        <span className="status">Confirmed</span>
        <h2>Test payment sent</h2>
        <p>
          {amount} USDTd was confirmed on Celo Sepolia. No real money was used.
        </p>
        <p className="addressBox">{hash}</p>
        <div className="actions">
          <a
            className="secondaryButton buttonLink"
            href={`https://celo-sepolia.blockscout.com/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Open transaction
          </a>
          <button className="primaryButton" onClick={reset}>
            Send another
          </button>
        </div>
      </section>
    );
  }

  if (stage === "review" || stage === "sending") {
    return (
      <section className="sendPanel">
        <p className="eyebrow">Review test payment</p>
        <h2>{amount} USDTd</h2>

        <div className="reviewRows">
          <div>
            <span>Recipient</span>
            <strong className="breakWord">{recipient}</strong>
          </div>
          <div>
            <span>Network</span>
            <strong>Celo Sepolia</strong>
          </div>
          <div>
            <span>Asset</span>
            <strong>USDTd · development only</strong>
          </div>
        </div>

        <p className="hint">
          Confirming will ask your Privy wallet to authorize the blockchain
          transaction.
        </p>

        {error ? <p className="errorText">{error}</p> : null}

        <div className="actions">
          <button
            className="secondaryButton"
            onClick={() => setStage("form")}
            disabled={stage === "sending"}
          >
            Back
          </button>
          <button
            className="primaryButton"
            onClick={() => void confirm()}
            disabled={stage === "sending"}
          >
            {stage === "sending" ? "Waiting for confirmation…" : "Approve & send"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="sendPanel">
      <p className="eyebrow">Send test USDT</p>
      <h2>New payment</h2>

      <label className="field">
        <span>Recipient wallet address</span>
        <input
          value={recipient}
          onChange={(event) => setRecipient(event.target.value.trim())}
          placeholder="0x…"
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>Amount</span>
        <div className="amountField">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
          <strong>USDTd</strong>
        </div>
      </label>

      <p className="hint">Available: {balance} USDTd</p>
      {validationError ? <p className="errorText">{validationError}</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button className="primaryButton" onClick={review}>
          Review payment
        </button>
      </div>
    </section>
  );
}
