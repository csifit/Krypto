"use client";

import { useEffect, useState } from "react";
import { isAddress } from "viem";
import {
  loadBeneficiaries,
  saveBeneficiaries,
} from "@/lib/payments/localStore";
import type { Beneficiary } from "@/lib/payments/types";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function BeneficiariesPanel({
  walletAddress,
  onChange,
}: {
  walletAddress: `0x${string}`;
  onChange?(beneficiaries: Beneficiary[]): void;
}) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadBeneficiaries(walletAddress);
    setBeneficiaries(stored);
    onChange?.(stored);
  }, [walletAddress, onChange]);

  function persist(next: Beneficiary[]) {
    setBeneficiaries(next);
    saveBeneficiaries(walletAddress, next);
    onChange?.(next);
  }

  function add() {
    setError(null);
    const cleanName = name.trim();
    const cleanAddress = address.trim();

    if (!cleanName) {
      setError("Enter a beneficiary name");
      return;
    }
    if (!isAddress(cleanAddress)) {
      setError("Enter a valid Celo/EVM wallet address");
      return;
    }
    if (
      beneficiaries.some(
        (item) => item.address.toLowerCase() === cleanAddress.toLowerCase(),
      )
    ) {
      setError("This wallet is already saved");
      return;
    }

    const next: Beneficiary[] = [
      ...beneficiaries,
      {
        id: makeId(),
        name: cleanName,
        address: cleanAddress as `0x${string}`,
        createdAt: new Date().toISOString(),
      },
    ];

    persist(next);
    setName("");
    setAddress("");
  }

  function remove(id: string) {
    persist(beneficiaries.filter((item) => item.id !== id));
  }

  return (
    <section className="businessPanel">
      <p className="eyebrow">Business primitives</p>
      <h2>Beneficiaries</h2>
      <p className="muted">
        Saved locally in this browser for v0.4. They are not yet synced to a
        Krypto backend.
      </p>

      {beneficiaries.length ? (
        <div className="beneficiaryList">
          {beneficiaries.map((beneficiary) => (
            <div className="beneficiaryRow" key={beneficiary.id}>
              <div>
                <strong>{beneficiary.name}</strong>
                <span>{beneficiary.address}</span>
              </div>
              <button className="textButton" onClick={() => remove(beneficiary.id)}>
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
        <button className="secondaryButton" onClick={add}>
          Add beneficiary
        </button>
      </div>
    </section>
  );
}
