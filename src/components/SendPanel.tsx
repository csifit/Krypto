"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { isAddress } from "viem";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_PAYMENT_NETWORK,
  IS_MAINNET,
  getTransactionExplorerUrl,
} from "@/lib/celo";
import {
  ACTIVE_STABLECOINS,
  DEFAULT_STABLECOIN,
  getActiveStablecoin,
  type StablecoinSymbol,
} from "@/lib/assets";
import { sendStablecoin } from "@/lib/blockchain/usdt";
import { useStablecoinBalance } from "@/hooks/useStablecoinBalance";
import { usePaymentReadiness } from "@/hooks/usePaymentReadiness";
import {
  createDirectCeloIntent,
  quoteDirectCeloIntent,
} from "@/lib/payments/directCelo";
import { authorizePayment, savePaymentRecord } from "@/lib/backend/client";
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

function compactAmount(value?: string) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export default function SendPanel({
  accountWalletAddress,
  sourceWallets,
  beneficiaries,
  initialRequest,
  initialSourceAddress,
  onSent,
}: {
  accountWalletAddress: `0x${string}`;
  sourceWallets: PaymentSourceWallet[];
  beneficiaries: Beneficiary[];
  initialRequest?: PaymentRequest;
  initialSourceAddress?: `0x${string}`;
  onSent(): Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(sourceWallets[0]?.id ?? "");
  const [assetSymbol, setAssetSymbol] = useState<StablecoinSymbol>(
    initialRequest?.asset ?? DEFAULT_STABLECOIN.symbol,
  );
  const [recipient, setRecipient] = useState(initialRequest?.recipient ?? "");
  const [amount, setAmount] = useState(initialRequest?.amount ?? "");
  const [memo, setMemo] = useState(initialRequest?.memo ?? "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [stage, setStage] = useState<"form" | "review" | "sending" | "success">("form");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const { getAccessToken } = usePrivy();

  const selectedSource =
    sourceWallets.find((source) => source.id === sourceId) ?? sourceWallets[0];
  const selectedAsset = getActiveStablecoin(assetSymbol) ?? DEFAULT_STABLECOIN;
  const payFeesInStablecoin = Boolean(
    IS_MAINNET &&
    selectedSource?.embedded &&
    selectedAsset.feeCurrencyAdapter,
  );

  useEffect(() => {
    if (!initialRequest) return;
    setRecipient(initialRequest.recipient);
    setAssetSymbol(initialRequest.asset);
    setAmount(initialRequest.amount ?? "");
    setMemo(initialRequest.memo ?? "");
    setError(null);
    setStage("form");
  }, [initialRequest]);

  useEffect(() => {
    if (!initialSourceAddress) return;
    const match = sourceWallets.find(
      (source) => source.wallet.address.toLowerCase() === initialSourceAddress.toLowerCase(),
    );
    if (match) setSourceId(match.id);
  }, [initialSourceAddress, sourceWallets]);

  function applyScannedPayment(value: string) {
    const request = parsePaymentRequestPayload(value);

    if (!request) {
      setError(
        "Unsupported QR code. Scan a Krypto121 payment request or compatible wallet QR.",
      );
      return;
    }

    setRecipient(request.recipient);
    setAssetSymbol(request.asset);
    setAmount(request.amount ?? "");
    setMemo(request.memo ?? "");
    setScannerOpen(false);
    setError(null);
    setIntent(null);
    setQuote(null);
    setStage("form");
  }

  const sourceBalance = useStablecoinBalance(
    selectedSource?.wallet.address,
    selectedAsset,
  );

  const selectedBeneficiary = beneficiaries.find(
    (item) => item.address.toLowerCase() === recipient.toLowerCase(),
  );

  const readiness = usePaymentReadiness({
    sourceAddress: selectedSource?.wallet.address,
    sourceBalance: sourceBalance.balance,
    sourceBalanceLoading: sourceBalance.loading,
    sourceBalanceError: sourceBalance.error,
    recipient,
    amount,
    assetSymbol: selectedAsset.symbol,
    payFeesInStablecoin,
  });

  const validationError = useMemo(() => {
    if (!recipient || !amount) return null;
    if (!isAddress(recipient)) return "Enter a valid wallet address";

    const number = Number(amount);
    if (!Number.isFinite(number) || number <= 0) {
      return "Amount must be greater than zero";
    }
    if (number > Number(sourceBalance.balance)) {
      return `Amount exceeds the selected wallet ${selectedAsset.symbol} balance`;
    }
    return null;
  }, [recipient, amount, sourceBalance.balance, selectedAsset.symbol]);

  const estimatedTotalDebit = useMemo(() => {
    if (!payFeesInStablecoin || !readiness.estimatedNetworkFeeAmount || !amount) {
      return undefined;
    }
    const paymentAmount = Number(amount);
    const feeAmount = Number(readiness.estimatedNetworkFeeAmount);
    if (!Number.isFinite(paymentAmount) || !Number.isFinite(feeAmount)) {
      return undefined;
    }
    return compactAmount(String(paymentAmount + feeAmount));
  }, [amount, payFeesInStablecoin, readiness.estimatedNetworkFeeAmount]);

  function review() {
    setError(null);

    if (!selectedSource) {
      setError("Connect a wallet before creating a payment");
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
    if (readiness.checking) {
      setError("Wait for payment readiness checks to finish");
      return;
    }
    if (!readiness.ready) {
      setError("Resolve the payment readiness checks before continuing");
      return;
    }

    try {
      const nextIntent = createDirectCeloIntent({
        sourceWallet: selectedSource.wallet.address,
        destination: recipient,
        amount,
        assetSymbol: selectedAsset.symbol,
        memo,
      });
      nextIntent.status = "quoted";

      const feeDescription =
        payFeesInStablecoin && readiness.estimatedNetworkFeeAmount
          ? `Estimated ~${compactAmount(readiness.estimatedNetworkFeeAmount)} ${selectedAsset.symbol}`
          : "Paid by the source wallet";

      const nextQuote = quoteDirectCeloIntent(nextIntent, {
        networkFeeDescription: feeDescription,
      });

      setIntent(nextIntent);
      setQuote(nextQuote);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create payment quote");
    }
  }

  async function confirm() {
    if (!intent || !quote || intent.sourceAsset.type !== "crypto") return;

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

    const executionAsset = getActiveStablecoin(intent.sourceAsset.symbol);
    if (!executionAsset) {
      setError("The payment asset is no longer supported.");
      setStage("form");
      return;
    }

    setStage("sending");
    setError(null);

    try {
      await authorizePayment(getAccessToken, {
        accountWalletAddress,
        sourceWallet: executionSource.wallet.address,
        amount: intent.sourceAmount,
        network: intent.sourceAsset.network,
      });

      intent.status = "executing";
      const txHash = await sendStablecoin(
        executionSource.wallet,
        intent.destination,
        intent.sourceAmount,
        executionAsset.symbol,
        {
          payFeesInStablecoin: Boolean(
            IS_MAINNET &&
            executionSource.embedded &&
            executionAsset.feeCurrencyAdapter,
          ),
        },
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
      setError(
        err instanceof Error
          ? err.message
          : `Could not send ${selectedAsset.symbol}`,
      );
    }
  }

  function reset() {
    setRecipient("");
    setAssetSymbol(DEFAULT_STABLECOIN.symbol);
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
  const intentSymbol =
    intent?.sourceAsset.type === "crypto"
      ? intent.sourceAsset.symbol
      : selectedAsset.symbol;

  if (stage === "success" && hash && intent) {
    return (
      <section className="sendPanel">
        <span className="status">Settled</span>
        <h2>Payment sent</h2>
        <p>
          {intent.sourceAmount} {intentSymbol} was confirmed through Krypto121&apos;s direct
          route on {ACTIVE_CELO_CHAIN.name}.{!IS_MAINNET ? " No real money was used." : ""}
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
              <strong>{ACTIVE_CELO_CHAIN.name}</strong>
            </div>
            <div>
              <span>Asset</span>
              <strong>{intentSymbol}</strong>
            </div>
            {IS_MAINNET && intentSource?.embedded ? (
              <div>
                <span>Network fee</span>
                <strong>Paid in {intentSymbol}</strong>
              </div>
            ) : null}
            <div>
              <span>Transaction ID</span>
              <strong className="breakWord">{hash}</strong>
            </div>
            <a
              className="inlineLink"
              href={getTransactionExplorerUrl(ACTIVE_PAYMENT_NETWORK, hash)}
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
        <h2>{quote.destinationAmount} {intentSymbol}</h2>

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
            <span>Recipient gets</span>
            <strong>{quote.destinationAmount} {intentSymbol}</strong>
          </div>
          <div>
            <span>Krypto121 fee</span>
            <strong>{quote.route.kryptoFeeAmount} {intentSymbol}</strong>
          </div>
          <div>
            <span>Network fee</span>
            <strong>{quote.route.networkFeeDescription}</strong>
          </div>
          {estimatedTotalDebit ? (
            <div>
              <span>Estimated total</span>
              <strong>~{estimatedTotalDebit} {intentSymbol}</strong>
            </div>
          ) : null}
          {intent.memo ? (
            <div>
              <span>Memo</span>
              <strong>{intent.memo}</strong>
            </div>
          ) : null}
        </div>

        <p className="hint">
          {IS_MAINNET && intentSource?.embedded
            ? `Krypto121 pays the network fee from ${intentSymbol} in the same wallet. No separate CELO balance is required.`
            : "Krypto121 creates the route, but the selected source wallet must approve the transaction."}
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

      {ACTIVE_STABLECOINS.length > 1 ? (
        <label className="field">
          <span>Asset</span>
          <select
            value={selectedAsset.symbol}
            onChange={(event) => {
              setAssetSymbol(event.target.value as StablecoinSymbol);
              setAmount("");
              setIntent(null);
              setQuote(null);
              setError(null);
            }}
          >
            {ACTIVE_STABLECOINS.map((asset) => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol} · {asset.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {beneficiaries.length ? (
        <label className="field">
          <span>Saved beneficiary</span>
          <select value="" onChange={(event) => {
            if (event.target.value) setRecipient(event.target.value);
          }}>
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
          <strong>{selectedAsset.symbol}</strong>
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

      <div className="paymentReadiness">
        <div className="paymentReadinessHeader">
          <div>
            <p className="eyebrow">Payment readiness</p>
            <h3>{readiness.ready ? "Ready to review" : "Preflight checks"}</h3>
          </div>
          <span className={`readinessOverall readinessOverall-${readiness.ready ? "ready" : readiness.checking ? "checking" : "pending"}`}>
            {readiness.ready ? "Ready" : readiness.checking ? "Checking" : "Not ready"}
          </span>
        </div>

        <div className="readinessList">
          {[readiness.recipient, readiness.funds, readiness.network, readiness.route].map((check) => (
            <div className="readinessRow" key={check.label}>
              <span className={`readinessDot readinessDot-${check.state}`} aria-hidden="true" />
              <div>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {readiness.network.state === "blocked" && readiness.route.state === "ready" ? (
          <p className="walletDirectoryNote">
            {payFeesInStablecoin
              ? `Keep a small amount of ${selectedAsset.symbol} available for the network fee.`
              : "This connected wallet needs network fee funds before it can send."}
          </p>
        ) : null}
      </div>

      <p className="hint">
        Available in selected wallet: {sourceBalance.loading ? "…" : sourceBalance.balance} {selectedAsset.symbol}
      </p>
      {validationError ? <p className="errorText">{validationError}</p> : null}
      {sourceBalance.error ? <p className="errorText">{sourceBalance.error}</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button
          className="primaryButton"
          onClick={review}
          disabled={!selectedSource || !readiness.ready}
        >
          {readiness.checking ? "Checking payment…" : "Review payment"}
        </button>
      </div>
    </section>
  );
}
