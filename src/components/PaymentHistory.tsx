"use client";

import { useEffect, useState } from "react";
import { loadPaymentHistory } from "@/lib/payments/localStore";
import type { LocalPaymentRecord } from "@/lib/payments/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function PaymentHistory({
  walletAddress,
  refreshKey,
}: {
  walletAddress: `0x${string}`;
  refreshKey: number;
}) {
  const [records, setRecords] = useState<LocalPaymentRecord[]>([]);

  useEffect(() => {
    setRecords(loadPaymentHistory(walletAddress));
  }, [walletAddress, refreshKey]);

  return (
    <section className="businessPanel">
      <p className="eyebrow">Local records · v0.4</p>
      <h2>Payment history</h2>
      <p className="muted">
        These records are browser-local annotations. The blockchain remains the
        source of truth for the actual transfer.
      </p>

      {records.length === 0 ? (
        <p className="hint">No locally recorded payments yet.</p>
      ) : (
        <div className="historyList">
          {records.map((record) => (
            <article className="historyRow" key={record.id}>
              <div>
                <strong>
                  {record.intent.sourceAmount} {record.intent.sourceAsset.symbol}
                </strong>
                <span>
                  To {record.beneficiaryName ?? shortAddress(record.intent.destination)}
                </span>
                {record.intent.memo ? <span>{record.intent.memo}</span> : null}
              </div>
              <div className="historyMeta">
                <span>Settled</span>
                <span>{new Date(record.settledAt).toLocaleString()}</span>
                <a
                  className="inlineLink inlineLinkNoMargin"
                  href={`https://celo-sepolia.blockscout.com/tx/${record.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
