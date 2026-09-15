"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ACTIVE_USDT } from "@/lib/celo";
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
}: {
  wallets: ReceiveWalletOption[];
}) {
  const [selectedId, setSelectedId] = useState(wallets[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const selected = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedId) ?? wallets[0],
    [selectedId, wallets],
  );

  useEffect(() => {
    if (!selected && wallets[0]) {
      setSelectedId(wallets[0].id);
    }
  }, [selected, wallets]);

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
  }, [selectedId]);

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
      const request = createPaymentRequest({
        recipient: selected.address,
        amount,
        memo,
      });
      const link = buildPaymentRequestLink(window.location.origin, request);
      const qr = await QRCode.toDataURL(link, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      setPaymentLink(link);
      setQrDataUrl(qr);
    } catch (error) {
      setPaymentLink(null);
      setQrDataUrl(null);
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
        ? `Payment request for ${amount.trim()} ${ACTIVE_USDT.symbol}`
        : "Krypto121 payment request",
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
      <h2>Receive {ACTIVE_USDT.symbol}</h2>

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
        {selected.detail ?? "Owned wallet"}. Share the address directly or create a QR/payment link.
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
              }}
              inputMode="decimal"
              placeholder="0.00"
            />
            <strong>{ACTIVE_USDT.symbol}</strong>
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
            }}
            maxLength={120}
            placeholder="Invoice 1042"
          />
        </label>

        <p className="hint">
          Leave the amount empty for a reusable QR. Add an amount/reference for a specific request.
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
              <strong>{amount.trim() ? `${amount.trim()} ${ACTIVE_USDT.symbol}` : "Amount chosen by payer"}</strong>
              <span>To {selected.label} · {shortAddress(selected.address)}</span>
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
              The QR contains a Krypto121 payment request. Scanning never sends funds automatically; the payer must review and approve the payment.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
