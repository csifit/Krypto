"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  cancelBusinessPaymentRequest,
  listBusinessPaymentRequests,
} from "@/lib/backend/client";
import type { BusinessPaymentRequest } from "@/lib/payments/businessRequest";
import {
  buildPaymentRequestLink,
  createPaymentRequest,
} from "@/lib/payments/paymentRequest";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function PaymentRequestsPanel({
  refreshKey,
  readOnly = false,
}: {
  refreshKey: number;
  readOnly?: boolean;
}) {
  const { getAccessToken } = usePrivy();
  const [requests, setRequests] = useState<BusinessPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listBusinessPaymentRequests(getAccessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payment requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // getAccessToken is stable in Privy; refreshKey drives explicit refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function copyLink(request: BusinessPaymentRequest) {
    const paymentRequest = createPaymentRequest({
      recipient: request.recipient,
      asset: request.asset,
      amount: request.amount,
      memo: request.memo,
      requestId: request.id,
    });
    const link = buildPaymentRequestLink(window.location.origin, paymentRequest);
    await navigator.clipboard.writeText(link);
    setCopiedId(request.id);
    window.setTimeout(() => setCopiedId(null), 1400);
  }

  async function cancel(id: string) {
    setWorkingId(id);
    setError(null);
    try {
      const updated = await cancelBusinessPaymentRequest(getAccessToken, id);
      setRequests((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel request");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="businessPanel">
      <p className="eyebrow">Incoming payments</p>
      <h2>Payment requests</h2>
      <p className="muted">
        Fixed-amount requests are tracked automatically after verified settlement.
      </p>

      {loading ? <p className="hint">Loading requests…</p> : null}
      {error ? <p className="errorText">{error}</p> : null}

      {!loading && !error && requests.length === 0 ? (
        <p className="hint">No tracked payment requests yet. Create one from Receive.</p>
      ) : null}

      {requests.length ? (
        <div className="historyList">
          {requests.map((request) => (
            <article className="historyRow" key={request.id}>
              <div>
                <strong>{request.amount} {request.asset}</strong>
                {request.businessName ? <span>{request.businessName}</span> : null}
                <span>To {shortAddress(request.recipient)}</span>
                {request.memo ? <span>{request.memo}</span> : null}
                <span>Created {new Date(request.createdAt).toLocaleString()}</span>
              </div>

              <div className="historyMeta">
                <span>
                  {request.status === "pending"
                    ? "Pending"
                    : request.status === "paid"
                      ? "Paid"
                      : "Cancelled"}
                </span>

                {request.paidAt ? (
                  <span>{new Date(request.paidAt).toLocaleString()}</span>
                ) : null}

                {request.status === "pending" ? (
                  <div className="actions">
                    <button
                      className="textButton"
                      onClick={() => void copyLink(request)}
                    >
                      {copiedId === request.id ? "Link copied" : "Copy link"}
                    </button>
                    <button
                      className="textButton"
                      disabled={readOnly || workingId === request.id}
                      onClick={() => void cancel(request.id)}
                    >
                      {workingId === request.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                ) : null}

                {request.paymentTxHash ? (
                  <details className="historyTechnicalDetails">
                    <summary>Technical details</summary>
                    <div className="historyTechnicalBody">
                      <span>Transaction: {shortAddress(request.paymentTxHash)}</span>
                    </div>
                  </details>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
