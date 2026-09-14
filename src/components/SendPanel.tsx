"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { isAddress } from "viem";
import { sendTestUsdt } from "@/lib/blockchain/usdt";
import { useUsdtBalance } from "@/hooks/useUsdtBalance";
import {
  createDirectCeloIntent,
  quoteDirectCeloIntent,
} from "@/lib/payments/directCelo";
import { savePaymentRecord } from "@/lib/backend/client";
import QrScanner from "@/components/QrScanner";
import { parsePaymentRequestPayload, type PaymentRequest } from "@/lib/payments/paymentRequest";
import type {
  Beneficiary,
  PaymentIntent,
  PaymentQuote,
} from "@/lib/payments/types";
import type { PaymentSourceWallet } from "@/lib/wallet/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function SendPanel({
  accountWalletAddress,
  sourceWallets,
  beneficiaries,
  initialRequest,
  onSent,
}: {
  accountWalletAddress: `0x${string}`;
  sourceWallets: PaymentSourceWallet[];
  beneficiaries: Beneficiary[];
  initialRequest?: PaymentRequest;
  onSent(): Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(
    sourceWallets[0]?.id ?? "",
  );
  const [recipient, setRecipient] = useState(initialRequest?.recipient ?? "");
  const [amount, setAmount] = useState(initialRequest?.amount ?? "");
  const [memo, setMemo] = useState(initialRequest?.memo ?? "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [stage, setStage] = useState<"form" | "review" | "sending" | "success">(
    "form",
  );
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const { getAccessToken } = usePrivy();

  const selectedSource =
    sourceWallets.find((source) => source.id === sourceId) ?? sourceWallets[0];

  useEffect(() => {
    if (!initialRequest) return;
    setRecipient(initialRequest.recipient);
    setAmount(initialRequest.amount ?? "");
    setMemo(initialRequest.memo ?? "");
    setError(null);
    setStage("form");
  }, [initialRequest]);

  function applyScannedPayment(value: string) {
    const request = parsePaymentRequestPayload(value);

    if (!request) {
      setError(
        "Unsupported QR code. Scan a Krypto121 payment request or compatible wallet QR.",
      );
      return;
    }

    setRecipient(request.recipient);
    setAmount(request.amount ?? "");
    setMemo(request.memo ?? "");
    setScannerOpen(false);
    setError(null);
    setIntent(null);
    setQuote(null);
    setStage("form");
  }

  const sourceBalance = useUsdtBalance(selectedSource?.wallet.address);

  const selectedBeneficiary = beneficiaries.find(
    (item) => item.address.toLowerCase() === recipient.toLowerCase(),
  );

  const validationError = useMemo(() => {
    if (!recipient || !amount) return null;
    if (!isAddress(recipient)) return "Enter a valid wallet address";

    const number = Number(amount);
    if (!Number.isFinite(number) || number <= 0) {
      return "Amount must be greater than zero";
    }
    if (number > Number(sourceBalance.balance)) {
      return "Amount exceeds the selected wallet balance";
    }
    return null;
  }, [recipient, amount, sourceBalance.balance]);

  function selectBeneficiary(value: string) {
    if (!value) return;
    setRecipient(value);
  }

  function review() {
    setError(null);

    if (!selectedSource) {
      setError("Connect a wallet before creating a payment");
      return;
    }
    if (sourceBalance.loading) {
      setError("Wait for the selected wallet balance to load");
      return;
    }
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
        sourceWallet: selectedSource.wallet.address,
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

    const executionSource = sourceWallets.find(
      (source) =>
        source.wallet.address.toLowerCase() === intent.sourceWallet.toLowerCase(),
    );

    if (!executionSource) {
      setError("The selected source wallet is no longer connected. Connect it again and review the payment.");
      setStage("form");
      return;
    }

    setStage("sending");
    setError(null);

    try {
      intent.status = "executing";
      const txHash = await sendTestUsdt(
        executionSource.wallet,
        intent.destination,
        intent.sourceAmount,
      );
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
        await savePaymentRecord(getAccessToken, accountWalletAddress, record);
      } catch (syncError) {
        setRecordWarning(
          syncError instanceof Error
            ? `Payment settled, but history sync failed: ${syncError.message}`
            : "Payment settled, but history sync failed.",
        );
      }

      setHash(txHash);
      setStage("success");
      await Promise.all([sourceBalance.refresh(), onSent()]);
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
    setScannerOpen(false);
    setStage("form");
  }

  const intentSource = intent
    ? sourceWallets.find(
        (source) => source.wallet.address.toLowerCase() === intent.sourceWallet.toLowerCase(),
      )
    : undefined;

  if (stage === "success" && hash && intent) {
    return (
      <section className="sendPanel">
        <span className="status">Settled</span>
        <h2>Test payment sent</h2>
        <p>
          {intent.sourceAmount} USDTd was confirmed through Krypto121&apos;s direct
          test route. No real money was used.
        </p>
        <p className="hint">
          From: {intentSource?.label ?? shortAddress(intent.sourceWallet)}
        </p>
        {intent.memo ? <p className="hint">Memo: {intent.memo}</p> : null}
        {recordWarning ? <p className="errorText">{recordWarning}</p> : null}
        <details className="technicalDetails">
          <summary>Technical details</summary>
          <div className="technicalDetailsBody">
            <div>
              <span>Network</span>
              <strong>Celo Sepolia</strong>
            </div>
            <div>
              <span>Transaction ID</span>
              <strong className="breakWord">{hash}</strong>
            </div>
            <a
              className="inlineLink"
              href={`https://celo-sepolia.blockscout.com/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on blockchain
            </a>
          </div>
        </details>
        <div className="actions">
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
            <span>Pay from</span>
            <strong>
              {intentSource?.label ?? shortAddress(intent.sourceWallet)} · {shortAddress(intent.sourceWallet)}
            </strong>
          </div>
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
            <span>Krypto121 fee</span>
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
          Krypto121 creates the route, but the selected source wallet must approve the transaction.
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

      <label className="field">
        <span>Pay from</span>
        <select
          value={selectedSource?.id ?? ""}
          onChange={(event) => {
            setSourceId(event.target.value);
            setError(null);
          }}
        >
          {sourceWallets.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label} · {shortAddress(source.wallet.address)}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">
        Only connected wallets that can sign are listed. Watch-only wallets can never be a payment source.
      </p>

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
        <span className="fieldLabelWithAction">
          <span>Recipient wallet address</span>
          <button
            className="textButton"
            type="button"
            onClick={() => {
              setScannerOpen((value) => !value);
              setError(null);
            }}
          >
            {scannerOpen ? "Close scanner" : "Scan QR"}
          </button>
        </span>
        <input
          value={recipient}
          onChange={(event) => setRecipient(event.target.value.trim())}
          placeholder="0x…"
          autoComplete="off"
        />
      </label>

      {scannerOpen ? (
        <QrScanner
          onScan={applyScannedPayment}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

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

      <p className="hint">
        Available in selected wallet: {sourceBalance.loading ? "…" : sourceBalance.balance} USDTd
      </p>
      {sourceBalance.error ? <p className="errorText">{sourceBalance.error}</p> : null}
      {validationError ? <p className="errorText">{validationError}</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button className="primaryButton" onClick={review} disabled={!selectedSource}>
          Get route & review
        </button>
      </div>
    </section>
  );
}
