"use client";

import { useEffect, useMemo, useState } from "react";

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

  const selected = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedId) ?? wallets[0],
    [selectedId, wallets],
  );

  useEffect(() => {
    if (!selected && wallets[0]) {
      setSelectedId(wallets[0].id);
    }
  }, [selected, wallets]);

  async function copyAddress() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
      <h2>Receive USDTd</h2>

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
        {selected.detail ?? "Owned wallet"}. Send only USDTd compatible with this development environment.
      </p>

      <p className="addressBox">{selected.address}</p>

      <div className="actions">
        <button className="primaryButton" onClick={() => void copyAddress()}>
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>
    </section>
  );
}
