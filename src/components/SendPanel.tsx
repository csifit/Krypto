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
  CELO_USDC,
  DEFAULT_STABLECOIN,
  PAYMENT_DESTINATIONS,
  getActiveStablecoin,
  type PaymentDestination,
  type StablecoinSymbol,
} from "@/lib/assets";
import { sendStablecoin } from "@/lib/blockchain/usdt";
import { useStablecoinBalance } from "@/hooks/useStablecoinBalance";
import { usePaymentReadiness } from "@/hooks/usePaymentReadiness";
import {
  createDirectCeloIntent,
  quoteDirectCeloIntent,
} from "@/lib/payments/directCelo";
import { createRelayPayment } from "@/lib/payments/relay";
import {
  authorizePayment,
  getRelayQuote,
  markRelaySubmitted,
  readRelayStatus,
  savePaymentRecord,
} from "@/lib/backend/client";
import { executeRelayQuote } from "@/lib/relay/execution";
import QrScanner from "@/components/QrScanner";
import { parsePaymentRequestPayload, type PaymentRequest } from "@/lib/payments/paymentRequest";
import type {
  Beneficiary,
  PaymentIntent,
  PaymentQuote,
} from "@/lib/payments/types";
import type { PaymentSourceWallet } from "@/lib/wallet/types";
import type { KryptoRelayQuote } from "@/lib/relay/types";

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

async function waitForRelaySettlement(
  getAccessToken: () => Promise<string | null>,
  requestId: string,
) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const status = await readRelayStatus(getAccessToken, requestId);

    if (status.status === "success") return status;
    if (status.status === "failure") throw new Error("Relay could not complete the payment");
    if (status.status === "refund" || status.status === "fallback") {
      throw new Error("Relay refunded the payment instead of settling it");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }

  throw new Error("Relay is still processing this payment. Please check again shortly.");
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
  const [destination, setDestination] = useState<PaymentDestination>("celo");
  const [assetSymbol, setAssetSymbol] = useState<StablecoinSymbol>(
    initialRequest?.asset ?? DEFAULT_STABLECOIN.symbol,
  );
  const [recipient, setRecipient] = useState(initialRequest?.recipient ?? "");
  const [amount, setAmount] = useState(initialRequest?.amount ?? "");
  const [memo, setMemo] = useState(initialRequest?.memo ?? "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [relayExecutionQuote, setRelayExecutionQuote] = useState<KryptoRelayQuote | null>(null);
  const [stage, setStage] = useState<"form" | "quoting" | "review" | "sending" | "success">("form");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const { getAccessToken } = usePrivy();

  const selectedSource =
    sourceWallets.find((source) => source.id === sourceId) ?? sourceWallets[0];

  const selectedAsset = destination === "base"
    ? CELO_USDC
    : (getActiveStablecoin(assetSymbol) ?? DEFAULT_STABLECOIN);

  const isRelayRoute = destination === "base";
  const payFeesInStablecoin = Boolean(
    IS_MAINNET &&
    selectedSource?.embedded &&
    selectedAsset.feeCurrencyAdapter,
  );

  useEffect(() => {
    if (!initialRequest) return;
    setDestination("celo");
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

  function clearQuote() {
    setIntent(null);
    setQuote(null);
    setRelayExecutionQuote(null);
    setError(null);
    setStage("form");
  }

  function applyScannedPayment(value: string) {
    const request = parsePaymentRequestPayload(value);

    if (!request) {
      setError(
        "Unsupported QR code. Scan a Krypto121 payment request or compatible wallet QR.",
      );
      return;
    }

    setDestination("celo");
    setRecipient(request.recipient);
    setAssetSymbol(request.asset);
    setAmount(request.amount ?? "");
    setMemo(request.memo ?? "");
    setScannerOpen(false);
    clearQuote();
  }

  const sourceBalance = useStablecoinBalance(
    selectedSource?.wallet.address,
    selectedAsset,
  );

  const selectedBeneficiary = beneficiaries.find(
    (item) => item.address.toLowerCase() === recipient.toLowerCase(),
  );

  const directReadiness = usePaymentReadiness({
    sourceAddress: selectedSource?.wallet.address,
    sourceBalance: sourceBalance.balance,
    sourceBalanceLoading: sourceBalance.loading,
    sourceBalanceError: sourceBalance.error,
    recipient,
    amount,
    assetSymbol: selectedAsset.symbol,
    payFeesInStablecoin,
  });

  const basicReady = Boolean(
    selectedSource &&
    recipient &&
    isAddress(recipient) &&
    Number.isFinite(Number(amount)) &&
    Number(amount) > 0 &&
    !sourceBalance.loading &&
    !sourceBalance.error &&
    Number(amount) <= Number(sourceBalance.balance),
  );

  const validationError = useMemo(() => {
    if (!recipient || !amount) return null;
    if (!isAddress(recipient)) return "Enter a valid wallet address";

    const number = Number(amount);
    if (!Number.isFinite(number) || number <= 0) return "Amount must be greater than zero";
    if (number > Number(sourceBalance.balance)) {
      return `Amount exceeds the selected wallet ${selectedAsset.symbol} balance`;
    }
    return null;
  }, [recipient, amount, sourceBalance.balance, selectedAsset.symbol]);

  async function review() {
    setError(null);

    if (!selectedSource) return setError("Connect a wallet before creating a payment");
    if (!recipient || !amount) return setError("Enter a recipient and amount");
    if (validationError) return setError(validationError);

    if (!isRelayRoute) {
      if (directReadiness.checking) return setError("Wait for payment readiness checks to finish");
      if (!directReadiness.ready) return setError("Resolve the payment readiness checks before continuing");

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
          payFeesInStablecoin && directReadiness.estimatedNetworkFeeAmount
            ? `Estimated ~${compactAmount(directReadiness.estimatedNetworkFeeAmount)} ${selectedAsset.symbol}`
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
      return;
    }

    if (!basicReady) {
      return setError("Complete the payment details before requesting a route");
    }

    setStage("quoting");
    try {
      const relayQuote = await getRelayQuote(getAccessToken, {
        sourceWallet: selectedSource.wallet.address,
        recipient: recipient as `0x${string}`,
        destinationAmount: amount,
      });

      if (Number(relayQuote.sourceAmount) > Number(sourceBalance.balance)) {
        throw new Error(
          `This route needs ${relayQuote.sourceAmount} USDC, but the selected wallet has ${sourceBalance.balance} USDC.`,
        );
      }

      const payment = createRelayPayment(relayQuote, memo);
      setRelayExecutionQuote(relayQuote);
      setIntent(payment.intent);
      setQuote(payment.quote);
      setStage("review");
    } catch (err) {
      setStage("form");
      setError(err instanceof Error ? err.message : "Could not quote cross-network payment");
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
      (source) => source.wallet.address.toLowerCase() === intent.sourceWallet.toLowerCase(),
    );

    if (!executionSource) {
      setError("The selected source wallet is no longer connected.");
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
        network: "celo",
      });

      intent.status = "executing";

      let txHash: `0x${string}`;

      if (quote.route.kind === "relay") {
        if (!relayExecutionQuote || !quote.route.relay) {
          throw new Error("Relay execution quote is unavailable. Review the payment again.");
        }

        const executed = await executeRelayQuote(executionSource, relayExecutionQuote);
        txHash = executed.depositTxHash;

        await markRelaySubmitted(getAccessToken, {
          requestId: quote.route.relay.requestId,
          txHash,
        });

        const relayStatus = await waitForRelaySettlement(
          getAccessToken,
          quote.route.relay.requestId,
        );

        if (relayStatus.destinationTxHash) {
          quote.route.relay.destinationTxHash = relayStatus.destinationTxHash;
        }
      } else {
        const executionAsset = getActiveStablecoin(intent.sourceAsset.symbol);
        if (!executionAsset) throw new Error("The payment asset is no longer supported.");

        txHash = await sendStablecoin(
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
      }

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
      setError(err instanceof Error ? err.message : "Could not complete payment");
    }
  }

  function reset() {
    setDestination("celo");
    setRecipient("");
    setAssetSymbol(DEFAULT_STABLECOIN.symbol);
    setAmount("");
    setMemo("");
    setIntent(null);
    setQuote(null);
    setRelayExecutionQuote(null);
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
    intent?.destinationAsset.type === "crypto"
      ? intent.destinationAsset.symbol
      : selectedAsset.symbol;

  if (stage === "success" && hash && intent && quote) {
    const relay = quote.route.kind === "relay" ? quote.route.relay : undefined;

    return (
      <section className="sendPanel">
        <span className="status">Settled</span>
        <h2>Payment sent</h2>
        <p>
          {intent.destinationAmount ?? intent.sourceAmount} {intentSymbol} reached the recipient
          {relay ? " on Base" : ` on ${ACTIVE_CELO_CHAIN.name}`}.
        </p>
        <p className="hint">From: {intentSource?.label ?? shortAddress(intent.sourceWallet)}</p>
        {intent.memo ? <p className="hint">Memo: {intent.memo}</p> : null}
        {recordWarning ? <p className="errorText">{recordWarning}</p> : null}

        <details className="technicalDetails">
          <summary>Technical details</summary>
          <div className="technicalDetailsBody">
            <div>
              <span>Route</span>
              <strong>{relay ? "Celo → Base · Relay" : "Direct Celo"}</strong>
            </div>
            <div>
              <span>Origin transaction</span>
              <strong className="breakWord">{hash}</strong>
            </div>
            <a
              className="inlineLink"
              href={getTransactionExplorerUrl(ACTIVE_PAYMENT_NETWORK, hash)}
              target="_blank"
              rel="noreferrer"
            >
              View origin transaction
            </a>
            {relay?.destinationTxHash ? (
              <a
                className="inlineLink"
                href={`https://basescan.org/tx/${relay.destinationTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View destination transaction
              </a>
            ) : null}
          </div>
        </details>

        <div className="actions">
          <button className="primaryButton" onClick={reset}>Send another</button>
        </div>
      </section>
    );
  }

  if ((stage === "review" || stage === "sending") && intent && quote) {
    const isRelay = quote.route.kind === "relay";

    return (
      <section className="sendPanel">
        <p className="eyebrow">Payment intent quoted</p>
        <h2>{quote.destinationAmount} {intentSymbol}</h2>

        <div className="reviewRows">
          <div>
            <span>Pay from</span>
            <strong>{intentSource?.label ?? shortAddress(intent.sourceWallet)} · {shortAddress(intent.sourceWallet)}</strong>
          </div>
          <div>
            <span>Recipient</span>
            <strong className="breakWord">{selectedBeneficiary?.name ?? intent.destination}</strong>
          </div>
          <div>
            <span>Destination</span>
            <strong>{isRelay ? "Base" : "Celo"}</strong>
          </div>
          <div>
            <span>Recipient gets</span>
            <strong>{quote.destinationAmount} {intentSymbol}</strong>
          </div>
          {isRelay ? (
            <>
              <div>
                <span>You pay</span>
                <strong>{quote.sourceAmount} USDC</strong>
              </div>
              <div>
                <span>Route cost</span>
                <strong>~{quote.route.routeCostAmount ?? "0"} USDC</strong>
              </div>
            </>
          ) : (
            <div>
              <span>Network fee</span>
              <strong>{quote.route.networkFeeDescription}</strong>
            </div>
          )}
          <div>
            <span>Krypto121 fee</span>
            <strong>{quote.route.kryptoFeeAmount} {intentSymbol}</strong>
          </div>
          {intent.memo ? (
            <div><span>Memo</span><strong>{intent.memo}</strong></div>
          ) : null}
        </div>

        <p className="hint">
          {isRelay
            ? "Krypto121 selected the cross-network route automatically. The recipient receives USDC on Base."
            : IS_MAINNET && intentSource?.embedded
              ? `Network fees are paid from ${intentSymbol} in the same wallet.`
              : "The selected source wallet must approve the transaction."}
        </p>

        {error ? <p className="errorText">{error}</p> : null}

        <div className="actions">
          <button className="secondaryButton" onClick={() => setStage("form")} disabled={stage === "sending"}>
            Back
          </button>
          <button className="primaryButton" onClick={() => void confirm()} disabled={stage === "sending"}>
            {stage === "sending" ? (isRelay ? "Completing cross-network payment…" : "Waiting for confirmation…") : "Approve & send"}
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
            clearQuote();
          }}
        >
          {sourceWallets.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label} · {shortAddress(source.wallet.address)}
            </option>
          ))}
        </select>
      </label>

      {IS_MAINNET ? (
        <label className="field">
          <span>Pay to</span>
          <select
            value={destination}
            onChange={(event) => {
              const next = event.target.value as PaymentDestination;
              setDestination(next);
              if (next === "base") setAssetSymbol("USDC");
              clearQuote();
            }}
          >
            {PAYMENT_DESTINATIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · {option.detail}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!isRelayRoute && ACTIVE_STABLECOINS.length > 1 ? (
        <label className="field">
          <span>Asset</span>
          <select
            value={selectedAsset.symbol}
            onChange={(event) => {
              setAssetSymbol(event.target.value as StablecoinSymbol);
              setAmount("");
              clearQuote();
            }}
          >
            {ACTIVE_STABLECOINS.map((asset) => (
              <option key={asset.symbol} value={asset.symbol}>
                {asset.symbol} · {asset.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        isRelayRoute ? <p className="hint">Base payments currently use USDC.</p> : null
      )}

      {beneficiaries.length ? (
        <label className="field">
          <span>Saved beneficiary</span>
          <select value="" onChange={(event) => {
            if (event.target.value) setRecipient(event.target.value);
          }}>
            <option value="">Choose beneficiary…</option>
            {beneficiaries.map((beneficiary) => (
              <option key={beneficiary.id} value={beneficiary.address}>{beneficiary.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field">
        <span className="fieldLabelWithAction">
          <span>Recipient wallet address</span>
          {!isRelayRoute ? (
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
          ) : null}
        </span>
        <input
          value={recipient}
          onChange={(event) => setRecipient(event.target.value.trim())}
          placeholder="0x…"
          autoComplete="off"
        />
      </label>

      {scannerOpen && !isRelayRoute ? (
        <QrScanner onScan={applyScannedPayment} onClose={() => setScannerOpen(false)} />
      ) : null}

      <label className="field">
        <span>{isRelayRoute ? "Recipient amount" : "Amount"}</span>
        <div className="amountField">
          <input
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setIntent(null);
              setQuote(null);
              setRelayExecutionQuote(null);
            }}
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

      {!isRelayRoute ? (
        <div className="paymentReadiness">
          <div className="paymentReadinessHeader">
            <div>
              <p className="eyebrow">Payment readiness</p>
              <h3>{directReadiness.ready ? "Ready to review" : "Preflight checks"}</h3>
            </div>
            <span className={`readinessOverall readinessOverall-${directReadiness.ready ? "ready" : directReadiness.checking ? "checking" : "pending"}`}>
              {directReadiness.ready ? "Ready" : directReadiness.checking ? "Checking" : "Not ready"}
            </span>
          </div>
          <div className="readinessList">
            {[directReadiness.recipient, directReadiness.funds, directReadiness.network, directReadiness.route].map((check) => (
              <div className="readinessRow" key={check.label}>
                <span className={`readinessDot readinessDot-${check.state}`} aria-hidden="true" />
                <div><strong>{check.label}</strong><span>{check.detail}</span></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="paymentReadiness">
          <div className="paymentReadinessHeader">
            <div>
              <p className="eyebrow">Payment readiness</p>
              <h3>{basicReady ? "Ready to quote" : "Complete payment details"}</h3>
            </div>
          </div>
          <div className="readinessList">
            <div className="readinessRow">
              <span className={`readinessDot readinessDot-${recipient && isAddress(recipient) ? "ready" : "waiting"}`} />
              <div><strong>Recipient</strong><span>{recipient && isAddress(recipient) ? "Ready" : "Enter a Base wallet address"}</span></div>
            </div>
            <div className="readinessRow">
              <span className={`readinessDot readinessDot-${basicReady ? "ready" : "waiting"}`} />
              <div><strong>Funds</strong><span>{sourceBalance.loading ? "Checking" : `${sourceBalance.balance} USDC available`}</span></div>
            </div>
            <div className="readinessRow">
              <span className="readinessDot readinessDot-waiting" />
              <div><strong>Route</strong><span>Live Relay quote at review</span></div>
            </div>
          </div>
        </div>
      )}

      <p className="hint">
        Available in selected wallet: {sourceBalance.loading ? "…" : sourceBalance.balance} {selectedAsset.symbol}
      </p>
      {validationError ? <p className="errorText">{validationError}</p> : null}
      {sourceBalance.error ? <p className="errorText">{sourceBalance.error}</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button
          className="primaryButton"
          onClick={() => void review()}
          disabled={
            !selectedSource ||
            stage === "quoting" ||
            (isRelayRoute ? !basicReady : !directReadiness.ready)
          }
        >
          {stage === "quoting" ? "Finding route…" : "Review payment"}
        </button>
      </div>
    </section>
  );
}
