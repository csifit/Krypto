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
        <p className="eyebrow">Receive test USDT</p>
        <h2>Your Celo Sepolia address</h2>
        <p className="addressBox">{address}</p>
      </div>

      <button className="secondaryButton" onClick={copyAddress}>
        {copied ? "Copied" : "Copy address"}
      </button>

      <p className="hint">
        Only use Celo Sepolia test assets here. Do not send real USDT to this
        development wallet.
      </p>
    </section>
  );
}
