"use client";

import { useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { isAddress } from "viem";
import { sendTestUsdt } from "@/lib/blockchain/usdt";
import {
  createDirectCeloIntent,
  quoteDirectCeloIntent,
} from "@/lib/payments/directCelo";
import { savePaymentRecord } from "@/lib/backend/client";
import type {
  Beneficiary,
  PaymentIntent,
  PaymentQuote,
} from "@/lib/payments/types";
import type { WalletProvider } from "@/lib/wallet/types";

export default function SendPanel({
  wallet,
  balance,
  beneficiaries,
  onSent,
}: {
  wallet: WalletProvider;
  balance: string;
  beneficiaries: Beneficiary[];
  onSent(): Promise<void>;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [stage, setStage] = useState<"form" | "review" | "sending" | "success">(
    "form",
  );
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const { getAccessToken } = usePrivy();

  const selectedBeneficiary = beneficiaries.find(
    (item) => item.address.toLowerCase() === recipient.toLowerCase(),
  );

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

  function selectBeneficiary(value: string) {
    if (!value) return;
    setRecipient(value);
  }

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

    try {
      const nextIntent = createDirectCeloIntent({
        sourceWallet: wallet.address,
        destination: recipient,
        amount,
        memo,
      });
      nextIntent.status = "quoted";
      const nextQuote = quoteDirectCeloIntent(nextIntent);
      setIntent(nextIntent);
      setQuote(nextQuote);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create payment quote");
    }
  }

  async function confirm() {
    if (!intent || !quote) return;

    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      setError("This quote expired. Review the payment again.");
      setStage("form");
      return;
    }

    setStage("sending");
    setError(null);

    try {
      intent.status = "executing";
      const txHash = await sendTestUsdt(wallet, intent.destination, intent.sourceAmount);
      intent.status = "settled";

      const record = {
        id: intent.id,
        intent,
        quote,
        txHash,
        status: "settled" as const,
        settledAt: new Date().toISOString(),
        beneficiaryName: selectedBeneficiary?.name,
      };

      try {
        await savePaymentRecord(getAccessToken, wallet.address, record);
      } catch (syncError) {
        setRecordWarning(
          syncError instanceof Error
            ? `Payment settled, but history sync failed: ${syncError.message}`
            : "Payment settled, but history sync failed.",
        );
      }

      setHash(txHash);
      setStage("success");
      await onSent();
    } catch (err) {
      intent.status = "failed";
      setStage("review");
      setError(err instanceof Error ? err.message : "Could not send test USDT");
    }
  }

  function reset() {
    setRecipient("");
    setAmount("");
    setMemo("");
    setIntent(null);
    setQuote(null);
    setError(null);
    setHash(null);
    setRecordWarning(null);
    setStage("form");
  }

  if (stage === "success" && hash && intent) {
    return (
      <section className="sendPanel">
        <span className="status">Settled</span>
        <h2>Test payment sent</h2>
        <p>
          {intent.sourceAmount} USDTd was confirmed on Celo Sepolia through the
          direct Krypto route. No real money was used.
        </p>
        {intent.memo ? <p className="hint">Memo: {intent.memo}</p> : null}
        {recordWarning ? <p className="errorText">{recordWarning}</p> : null}
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

  if ((stage === "review" || stage === "sending") && intent && quote) {
    return (
      <section className="sendPanel">
        <p className="eyebrow">Payment intent quoted</p>
        <h2>{quote.destinationAmount} USDTd</h2>

        <div className="reviewRows">
          <div>
            <span>Recipient</span>
            <strong className="breakWord">
              {selectedBeneficiary?.name ?? intent.destination}
            </strong>
          </div>
          <div>
            <span>Route</span>
            <strong>{quote.route.steps[0]?.description}</strong>
          </div>
          <div>
            <span>Krypto fee</span>
            <strong>{quote.route.kryptoFeeAmount} USDTd</strong>
          </div>
          <div>
            <span>Network fee</span>
            <strong>{quote.route.networkFeeDescription}</strong>
          </div>
          {intent.memo ? (
            <div>
              <span>Memo</span>
              <strong>{intent.memo}</strong>
            </div>
          ) : null}
        </div>

        <p className="hint">
          This is Krypto&apos;s first route: a direct same-chain transfer. Future
          quotes can replace it with swap, bridge, off-ramp, FX, or CBDC steps.
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
      <p className="eyebrow">Create payment intent</p>
      <h2>New payment</h2>

      {beneficiaries.length ? (
        <label className="field">
          <span>Saved beneficiary</span>
          <select value="" onChange={(event) => selectBeneficiary(event.target.value)}>
            <option value="">Choose beneficiary…</option>
            {beneficiaries.map((beneficiary) => (
              <option key={beneficiary.id} value={beneficiary.address}>
                {beneficiary.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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

      <label className="field">
        <span>Memo (optional)</span>
        <input
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          maxLength={120}
          placeholder="Invoice 1042"
        />
      </label>

      <p className="hint">Available: {balance} USDTd</p>
      {validationError ? <p className="errorText">{validationError}</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button className="primaryButton" onClick={review}>
          Get route & review
        </button>
      </div>
    </section>
  );
}
