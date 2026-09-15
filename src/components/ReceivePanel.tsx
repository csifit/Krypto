"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  ACTIVE_STABLECOINS,
  DEFAULT_STABLECOIN,
  getActiveStablecoin,
  type StablecoinSymbol,
} from "@/lib/assets";
import { createBusinessPaymentRequest } from "@/lib/backend/client";
import {
  buildPaymentRequestLink,
  createPaymentRequest,
} from "@/lib/payments/paymentRequest";

export type ReceiveWalletOption = {
  id: string;
  label: string;
  address: `0x${string}`;
  detail?: string;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function ReceivePanel({
  wallets,
  getAccessToken,
  onTrackedRequestCreated,
  defaultWalletAddress,
  defaultAssetSymbol,
  businessName,
}: {
  wallets: ReceiveWalletOption[];
  getAccessToken(): Promise<string | null>;
  onTrackedRequestCreated?(): void;
  defaultWalletAddress?: `0x${string}`;
  defaultAssetSymbol?: StablecoinSymbol;
  businessName?: string;
}) {
  const [selectedId, setSelectedId] = useState(wallets[0]?.id ?? "");
  const [assetSymbol, setAssetSymbol] = useState<StablecoinSymbol>(
    DEFAULT_STABLECOIN.symbol,
  );
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [tracked, setTracked] = useState(false);

  const selected = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedId) ?? wallets[0],
    [selectedId, wallets],
  );
  const selectedAsset = getActiveStablecoin(assetSymbol) ?? DEFAULT_STABLECOIN;

  useEffect(() => {
    if (!selected && wallets[0]) setSelectedId(wallets[0].id);
  }, [selected, wallets]);

  useEffect(() => {
    if (!defaultWalletAddress) return;
    const match = wallets.find(
      (wallet) => wallet.address.toLowerCase() === defaultWalletAddress.toLowerCase(),
    );
    if (match) setSelectedId(match.id);
  }, [defaultWalletAddress, wallets]);

  useEffect(() => {
    if (defaultAssetSymbol && getActiveStablecoin(defaultAssetSymbol)) {
      setAssetSymbol(defaultAssetSymbol);
    }
  }, [defaultAssetSymbol]);

  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" &&
        "share" in navigator &&
        typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    setPaymentLink(null);
    setQrDataUrl(null);
    setRequestError(null);
    setLinkCopied(false);
    setTracked(false);
  }, [selectedId, assetSymbol]);

  async function copyAddress() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function createRequest() {
    if (!selected) return;

    setCreating(true);
    setRequestError(null);
    setLinkCopied(false);

    try {
      const fixedAmount = amount.trim();
      let requestId: string | undefined;

      if (fixedAmount) {
        const saved = await createBusinessPaymentRequest(getAccessToken, {
          recipient: selected.address,
          asset: selectedAsset.symbol,
          amount: fixedAmount,
          memo,
        });
        requestId = saved.id;
      }

      const request = createPaymentRequest({
        recipient: selected.address,
        asset: selectedAsset.symbol,
        amount: fixedAmount,
        memo,
        requestId,
      });

      const link = buildPaymentRequestLink(window.location.origin, request);
      const qr = await QRCode.toDataURL(link, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      setPaymentLink(link);
      setQrDataUrl(qr);
      setTracked(Boolean(requestId));

      if (requestId) onTrackedRequestCreated?.();
    } catch (error) {
      setPaymentLink(null);
      setQrDataUrl(null);
      setTracked(false);
      setRequestError(
        error instanceof Error ? error.message : "Could not create payment request",
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyPaymentLink() {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1400);
  }

  async function sharePaymentRequest() {
    if (!paymentLink || !canShare) return;

    await navigator.share({
      title: "Krypto121 payment request",
      text: amount.trim()
        ? `Payment request for ${amount.trim()} ${selectedAsset.symbol}`
        : `Krypto121 ${selectedAsset.symbol} payment request`,
      url: paymentLink,
    });
  }

  if (!selected) {
    return (
      <section className="receivePanel">
        <h2>Receive</h2>
        <p className="muted">No owned wallet is available.</p>
      </section>
    );
  }

  return (
    <section className="receivePanel">
      <p className="eyebrow">Receive funds</p>
      <h2>Receive {selectedAsset.symbol}</h2>

      {ACTIVE_STABLECOINS.length > 1 ? (
        <label className="field">
          <span>Asset</span>
          <select
            value={selectedAsset.symbol}
            onChange={(event) => {
              setAssetSymbol(event.target.value as StablecoinSymbol);
              setAmount("");
              setCopied(false);
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

      {wallets.length > 1 ? (
        <label className="field">
          <span>Receive into</span>
          <select
            value={selected.id}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setCopied(false);
            }}
          >
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.label} · {shortAddress(wallet.address)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p className="hint">
        {selected.detail ?? "Owned wallet"}. Share this Celo address for {selectedAsset.symbol}, or create a QR/payment link.
      </p>

      <p className="addressBox">{selected.address}</p>

      <div className="actions">
        <button className="secondaryButton" onClick={() => void copyAddress()}>
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>

      <div className="paymentRequestBuilder">
        <div className="paymentRequestHeading">
          <div>
            <p className="eyebrow">Payment request</p>
            <h3>Create QR & payment link</h3>
          </div>
        </div>

        <label className="field">
          <span>Amount (optional)</span>
          <div className="amountField">
            <input
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setPaymentLink(null);
                setQrDataUrl(null);
                setTracked(false);
              }}
              inputMode="decimal"
              placeholder="0.00"
            />
            <strong>{selectedAsset.symbol}</strong>
          </div>
        </label>

        <label className="field">
          <span>Reference (optional)</span>
          <input
            value={memo}
            onChange={(event) => {
              setMemo(event.target.value);
              setPaymentLink(null);
              setQrDataUrl(null);
              setTracked(false);
            }}
            maxLength={120}
            placeholder="Invoice 1042"
          />
        </label>

        <p className="hint">
          Add an amount for a tracked business request. Leave it empty for a reusable, untracked QR.
        </p>

        {requestError ? <p className="errorText">{requestError}</p> : null}

        <div className="actions">
          <button
            className="primaryButton"
            type="button"
            onClick={() => void createRequest()}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create payment request"}
          </button>
        </div>

        {qrDataUrl && paymentLink ? (
          <div className="paymentRequestResult">
            <div className="paymentQrFrame">
              <Image
                src={qrDataUrl}
                width={300}
                height={300}
                unoptimized
                alt="Krypto121 payment request QR code"
              />
            </div>

            <div className="paymentRequestSummary">
              <strong>
                {amount.trim()
                  ? `${amount.trim()} ${selectedAsset.symbol}`
                  : `${selectedAsset.symbol} · amount chosen by payer`}
              </strong>
              {businessName ? <span>From {businessName}</span> : null}
              <span>To {selected.label} · {shortAddress(selected.address)}</span>
              {tracked ? <span>Tracked request · Pending</span> : <span>Reusable request</span>}
              {memo.trim() ? <span>Reference: {memo.trim()}</span> : null}
            </div>

            <div className="actions paymentRequestActions">
              <button className="secondaryButton" onClick={() => void copyPaymentLink()}>
                {linkCopied ? "Link copied" : "Copy payment link"}
              </button>
              {canShare ? (
                <button className="secondaryButton" onClick={() => void sharePaymentRequest()}>
                  Share
                </button>
              ) : null}
            </div>

            <p className="walletDirectoryNote">
              Scanning never sends funds automatically; the payer must review and approve the payment.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
