"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  getCeloChainForPaymentNetwork,
  getTransactionExplorerUrl,
  type CeloPaymentNetwork,
} from "@/lib/celo";
import { listPayments } from "@/lib/backend/client";
import type { LocalPaymentRecord } from "@/lib/payments/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function PaymentHistory({ refreshKey }: { refreshKey: number }) {
  const { getAccessToken } = usePrivy();
  const [records, setRecords] = useState<LocalPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const next = await listPayments(getAccessToken);
        if (!cancelled) setRecords(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load payment history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [getAccessToken, refreshKey]);

  return (
    <section className="businessPanel">
      <p className="eyebrow">Krypto121 records</p>
      <h2>Payment history</h2>
      <p className="muted">
        Krypto121 stores the business record. Technical settlement details remain available when needed.
      </p>

      {loading ? <p className="hint">Loading payments…</p> : null}
      {error ? <p className="errorText">{error}</p> : null}
      {!loading && !error && records.length === 0 ? <p className="hint">No recorded payments yet.</p> : null}

      {records.length ? (
        <div className="historyList">
          {records.map((record) => {
            const sourceNetwork =
              record.intent.sourceAsset.type === "crypto"
                ? (record.intent.sourceAsset.network as CeloPaymentNetwork)
                : "celo-sepolia";
            const chain = getCeloChainForPaymentNetwork(sourceNetwork === "celo" ? "celo" : "celo-sepolia");
            const relay = record.quote.route.kind === "relay" ? record.quote.route.relay : undefined;

            return (
              <article className="historyRow" key={record.id}>
                <div>
                  <strong>
                    {record.intent.destinationAmount ?? record.intent.sourceAmount} {record.intent.destinationAsset.symbol}
                  </strong>
                  <span>To {record.beneficiaryName ?? shortAddress(record.intent.destination)}</span>
                  {relay ? <span>Celo → Base</span> : null}
                  {record.intent.memo ? <span>{record.intent.memo}</span> : null}
                </div>
                <div className="historyMeta">
                  <span>Settled</span>
                  <span>{new Date(record.settledAt).toLocaleString()}</span>
                  <details className="historyTechnicalDetails">
                    <summary>Technical details</summary>
                    <div className="historyTechnicalBody">
                      <span>Origin: {chain.name}</span>
                      {relay ? <span>Destination: Base</span> : null}
                      {record.verification ? (
                        <span>Settlement: {relay ? "Verified through Relay + origin chain" : "Verified on-chain"}</span>
                      ) : null}
                      <span>Origin transaction: {shortAddress(record.txHash)}</span>
                      <a
                        className="inlineLink inlineLinkNoMargin"
                        href={getTransactionExplorerUrl(sourceNetwork === "celo" ? "celo" : "celo-sepolia", record.txHash)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View origin transaction
                      </a>
                      {relay?.destinationTxHash ? (
                        <a
                          className="inlineLink inlineLinkNoMargin"
                          href={`https://basescan.org/tx/${relay.destinationTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View destination transaction
                        </a>
                      ) : null}
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
