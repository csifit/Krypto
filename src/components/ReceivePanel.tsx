"use client";

import { useState } from "react";

export default function ReceivePanel({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="receivePanel">
      <div>
        <p className="eyebrow">Receive test funds</p>
        <h2>Your Celo Sepolia address</h2>
        <p className="addressBox">{address}</p>
      </div>

      <button className="secondaryButton" onClick={copyAddress}>
        {copied ? "Copied" : "Copy address"}
      </button>

      <p className="hint">
        Development network only. Do not send real USDT to this test flow.
      </p>
    </section>
  );
}
