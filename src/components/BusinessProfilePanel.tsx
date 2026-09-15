"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  listBusinessPaymentRequests,
  listPayments,
  saveBusinessProfile,
} from "@/lib/backend/client";
import { ACTIVE_STABLECOINS } from "@/lib/assets";
import type { BusinessProfile } from "@/lib/business/profile";
import type { LocalPaymentRecord } from "@/lib/payments/types";
import type { BusinessPaymentRequest } from "@/lib/payments/businessRequest";
import type { ReceiveWalletOption } from "@/components/ReceivePanel";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function BusinessProfilePanel({
  wallets,
  accountEmail,
  profile,
  onSaved,
  readOnly = false,
}: {
  wallets: ReceiveWalletOption[];
  accountEmail?: string;
  profile: BusinessProfile | null;
  onSaved(profile: BusinessProfile): void;
  readOnly?: boolean;
}) {
  const { getAccessToken } = usePrivy();
  const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
  const [countryCode, setCountryCode] = useState(profile?.countryCode ?? "");
  const [businessEmail, setBusinessEmail] = useState(
    profile?.businessEmail ?? accountEmail ?? "",
  );
  const [defaultWallet, setDefaultWallet] = useState<string>(
    profile?.defaultReceiveWallet ?? wallets[0]?.address ?? "",
  );
  const [defaultAsset, setDefaultAsset] = useState<string>(
    profile?.defaultReceiveAsset ?? ACTIVE_STABLECOINS[0]?.symbol ?? "",
  );
  const [requests, setRequests] = useState<BusinessPaymentRequest[]>([]);
  const [payments, setPayments] = useState<LocalPaymentRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBusinessName(profile?.businessName ?? "");
    setCountryCode(profile?.countryCode ?? "");
    setBusinessEmail(profile?.businessEmail ?? accountEmail ?? "");
    setDefaultWallet(profile?.defaultReceiveWallet ?? wallets[0]?.address ?? "");
    setDefaultAsset(
      profile?.defaultReceiveAsset ??
        ACTIVE_STABLECOINS[0]?.symbol ??
        "",
    );
  }, [profile, accountEmail, wallets]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoadingActivity(true);
      try {
        const [nextRequests, nextPayments] = await Promise.all([
          listBusinessPaymentRequests(getAccessToken),
          listPayments(getAccessToken),
        ]);

        if (!cancelled) {
          setRequests(nextRequests);
          setPayments(nextPayments);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load business activity",
          );
        }
      } finally {
        if (!cancelled) setLoadingActivity(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const pendingCount = useMemo(
    () =>
      requests.filter((item) => item.status === "pending").length,
    [requests],
  );

  const paidCount = useMemo(
    () =>
      requests.filter((item) => item.status === "paid").length,
    [requests],
  );

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await saveBusinessProfile(getAccessToken, {
        businessName,
        countryCode: countryCode.trim() || undefined,
        businessEmail: businessEmail.trim() || undefined,
        defaultReceiveWallet: defaultWallet
          ? (defaultWallet as `0x${string}`)
          : undefined,
        defaultReceiveAsset: defaultAsset || undefined,
      });

      onSaved(saved);
      setMessage("Business profile saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save business profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="businessPanel">
      <p className="eyebrow">Krypto121 Business</p>
      <h2>Business profile</h2>
      <p className="muted">
        Your business name is shown on new tracked payment
        requests. Login identity remains separate.
      </p>

      <label className="field">
        <span>Business / trading name</span>
        <input
          value={businessName}
          onChange={(event) =>
            setBusinessName(event.target.value)
          }
          maxLength={120}
          placeholder="Acme SRL"
          disabled={readOnly}
        />
      </label>

      <label className="field">
        <span>Country</span>
        <input
          value={countryCode}
          onChange={(event) =>
            setCountryCode(event.target.value.toUpperCase())
          }
          maxLength={2}
          placeholder="RO"
          disabled={readOnly}
        />
      </label>

      <label className="field">
        <span>Business email</span>
        <input
          value={businessEmail}
          onChange={(event) =>
            setBusinessEmail(event.target.value)
          }
          type="email"
          placeholder="payments@example.com"
          disabled={readOnly}
        />
      </label>

      <div className="paymentRequestHeading">
        <div>
          <p className="eyebrow">Receive defaults</p>
          <h3>Payment preferences</h3>
        </div>
      </div>

      <label className="field">
        <span>Default receive wallet</span>
        <select
          value={defaultWallet}
          onChange={(event) =>
            setDefaultWallet(event.target.value)
          }
          disabled={readOnly}
        >
          {wallets.map((wallet) => (
            <option
              key={wallet.id}
              value={wallet.address}
            >
              {wallet.label} · {shortAddress(wallet.address)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Default receive asset</span>
        <select
          value={defaultAsset}
          onChange={(event) =>
            setDefaultAsset(event.target.value)
          }
          disabled={readOnly}
        >
          {ACTIVE_STABLECOINS.map((asset) => (
            <option
              key={asset.symbol}
              value={asset.symbol}
            >
              {asset.symbol} · {asset.name}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="errorText">{error}</p> : null}
      {message ? <p className="hint">{message}</p> : null}

      <div className="actions">
        <button
          className="primaryButton"
          onClick={() => void save()}
          disabled={
            readOnly ||
            saving ||
            !businessName.trim()
          }
        >
          {saving ? "Saving…" : "Save business profile"}
        </button>
      </div>

      <div className="paymentRequestHeading">
        <div>
          <p className="eyebrow">Business activity</p>
          <h3>Overview</h3>
        </div>
      </div>

      <div className="reviewRows">
        <div>
          <span>Pending requests</span>
          <strong>
            {loadingActivity ? "…" : pendingCount}
          </strong>
        </div>
        <div>
          <span>Paid requests</span>
          <strong>
            {loadingActivity ? "…" : paidCount}
          </strong>
        </div>
      </div>

      <div className="historyList">
        {payments.slice(0, 3).map((payment) => (
          <article
            className="historyRow"
            key={payment.id}
          >
            <div>
              <strong>
                {payment.intent.destinationAmount ??
                  payment.intent.sourceAmount}{" "}
                {payment.intent.destinationAsset.symbol}
              </strong>
              <span>
                To {shortAddress(payment.intent.destination)}
              </span>
            </div>

            <div className="historyMeta">
              <span>
                {new Date(
                  payment.settledAt,
                ).toLocaleString()}
              </span>
            </div>
          </article>
        ))}

        {!loadingActivity && payments.length === 0 ? (
          <p className="hint">No settled payments yet.</p>
        ) : null}
      </div>
    </section>
  );
}
