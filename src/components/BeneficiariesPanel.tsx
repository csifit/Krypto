"use client";

import { useState } from "react";
import { isAddress } from "viem";
import type { Beneficiary } from "@/lib/payments/types";

export default function BeneficiariesPanel({
  beneficiaries,
  loading,
  onAdd,
  onRemove,
}: {
  beneficiaries: Beneficiary[];
  loading?: boolean;
  onAdd(name: string, address: `0x${string}`): Promise<void>;
  onRemove(id: string): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add() {
    setError(null);
    const cleanName = name.trim();
    const cleanAddress = address.trim();

    if (!cleanName) return setError("Enter a beneficiary name");
    if (!isAddress(cleanAddress)) {
      return setError("Enter a valid Celo/EVM wallet address");
    }

    setSaving(true);
    try {
      await onAdd(cleanName, cleanAddress as `0x${string}`);
      setName("");
      setAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save beneficiary");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    setSaving(true);
    try {
      await onRemove(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove beneficiary");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="businessPanel">
      <p className="eyebrow">Business</p>
      <h2>Beneficiaries</h2>
      <p className="muted">Saved securely to your Krypto121 account.</p>

      {loading ? (
        <p className="hint">Loading beneficiaries…</p>
      ) : beneficiaries.length ? (
        <div className="beneficiaryList">
          {beneficiaries.map((beneficiary) => (
            <div className="beneficiaryRow" key={beneficiary.id}>
              <div>
                <strong>{beneficiary.name}</strong>
                <span>{beneficiary.address}</span>
              </div>
              <button
                className="textButton"
                onClick={() => void remove(beneficiary.id)}
                disabled={saving}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint">No saved beneficiaries yet.</p>
      )}

      <div className="twoFields">
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Supplier ABC"
          />
        </label>
        <label className="field">
          <span>Wallet address</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value.trim())}
            placeholder="0x…"
            autoComplete="off"
          />
        </label>
      </div>

      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button className="secondaryButton" onClick={() => void add()} disabled={saving}>
          {saving ? "Saving…" : "Add beneficiary"}
        </button>
      </div>
    </section>
  );
}
