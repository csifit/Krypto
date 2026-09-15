"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import DashboardSidebar, { type SecondarySection } from "@/components/DashboardSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import {
  addBeneficiaryWallet,
  createBeneficiaryPartner,
  listBeneficiaryPartners,
  listPayments,
  removeBeneficiaryWallet,
  syncProfile,
  updateBeneficiaryPartner,
  updateBeneficiaryWallet,
  type AccountProfileSummary,
} from "@/lib/backend/client";
import type {
  BeneficiaryPartner,
  PartnerType,
} from "@/lib/beneficiaries/types";
import type { LocalPaymentRecord } from "@/lib/payments/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function historyForPartner(
  partner: BeneficiaryPartner,
  records: LocalPaymentRecord[],
) {
  const addresses = new Set(
    partner.wallets.map((wallet) => wallet.address.toLowerCase()),
  );

  return records.filter(
    (record) =>
      record.beneficiaryPartnerId === partner.id ||
      addresses.has(record.intent.destination.toLowerCase()),
  );
}

export default function BeneficiariesPage() {
  const router = useRouter();
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const [menuOpen, setMenuOpen] = useState(false);
  const [partners, setPartners] = useState<BeneficiaryPartner[]>([]);
  const [profile, setProfile] = useState<AccountProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PartnerType>("business");
  const [newAddress, setNewAddress] = useState("");

  const [paymentWallets, setPaymentWallets] = useState<Record<string, string>>({});
  const [historyPartner, setHistoryPartner] = useState<BeneficiaryPartner | null>(null);
  const [historyRecords, setHistoryRecords] = useState<LocalPaymentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === "privy");
  const embeddedAddress = embeddedWallet?.address as `0x${string}` | undefined;

  const sortedPartners = useMemo(
    () =>
      [...partners].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [partners],
  );

  useEffect(() => {
    if (!embeddedAddress) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileResult, nextPartners] = await Promise.all([
          syncProfile(getAccessToken, embeddedAddress),
          listBeneficiaryPartners(getAccessToken),
        ]);

        if (!cancelled) {
          setProfile(profileResult.profile);
          setPartners(nextPartners);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load beneficiaries");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embeddedAddress, getAccessToken]);

  function handleSidebar(section: SecondarySection) {
    if (section === "beneficiaries") return;
    if (section === "wallets") {
      router.push("/wallets");
      return;
    }
    if (section === null) {
      router.push("/");
      return;
    }
    router.push(`/?section=${section}`);
  }

  async function addPartner() {
    setError(null);

    const name = newName.trim();
    const address = newAddress.trim();

    if (!name) {
      setError("Enter a partner name");
      return;
    }
    if (!isAddress(address)) {
      setError("Enter a valid wallet address");
      return;
    }

    setSaving(true);
    try {
      const next = await createBeneficiaryPartner(getAccessToken, {
        name,
        partnerType: newType,
        address: address as `0x${string}`,
      });

      setPartners(next);
      setNewName("");
      setNewType("business");
      setNewAddress("");
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save partner");
    } finally {
      setSaving(false);
    }
  }

  async function savePartner(
    partnerId: string,
    name: string,
    partnerType: PartnerType,
  ) {
    setSaving(true);
    setError(null);
    try {
      setPartners(
        await updateBeneficiaryPartner(getAccessToken, {
          partnerId,
          name,
          partnerType,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update partner");
    } finally {
      setSaving(false);
    }
  }

  async function addWallet(partnerId: string, address: string) {
    if (!isAddress(address)) {
      setError("Enter a valid wallet address");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      setPartners(
        await addBeneficiaryWallet(getAccessToken, {
          partnerId,
          address: address as `0x${string}`,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add wallet");
    } finally {
      setSaving(false);
    }
  }

  async function saveWallet(
    partnerId: string,
    walletId: string,
    address: string,
  ) {
    if (!isAddress(address)) {
      setError("Enter a valid wallet address");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      setPartners(
        await updateBeneficiaryWallet(getAccessToken, {
          partnerId,
          walletId,
          address: address as `0x${string}`,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update wallet");
    } finally {
      setSaving(false);
    }
  }

  async function removeWallet(partnerId: string, walletId: string) {
    setSaving(true);
    setError(null);
    try {
      setPartners(
        await removeBeneficiaryWallet(getAccessToken, {
          partnerId,
          walletId,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove wallet");
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(partner: BeneficiaryPartner) {
    setHistoryPartner(partner);
    setHistoryLoading(true);
    setError(null);

    try {
      const records = await listPayments(getAccessToken);
      setHistoryRecords(historyForPartner(partner, records));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payment history");
    } finally {
      setHistoryLoading(false);
    }
  }

  if (!ready || !walletsReady) {
    return (
      <main className="shell">
        <section className="panel">
          <p>Loading Krypto121…</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="landingShell">
        <header className="landingHeader">
          <strong>Krypto121</strong>
          <ThemeToggle compact />
        </header>
        <section className="landingHero">
          <p className="eyebrow">Beneficiaries</p>
          <h1>Manage payment partners.</h1>
          <p className="landingLead">
            Sign in to manage saved business and private recipients.
          </p>
          <button className="primaryButton landingCta" onClick={login}>
            Create account/Log in
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="dashboardApp">
      <DashboardSidebar
        open={menuOpen}
        activeSection="beneficiaries"
        email={user?.email?.address}
        onClose={() => setMenuOpen(false)}
        onSelect={handleSidebar}
        onLogout={logout}
        isSuperAdmin={profile?.role === "super_admin"}
      />

      <main className="dashboardMain">
        <header className="mobileTopbar">
          <button
            className="hamburgerButton"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
          <strong>Krypto121</strong>
          <ThemeToggle compact />
        </header>

        <div className="dashboardContent beneficiariesPageContent">
          <header className="walletPageHeader">
            <div>
              <p className="eyebrow">Payment partners</p>
              <h1 className="dashboardTitle">Beneficiaries</h1>
              <p className="walletPageLead">
                Business and private partners, with all of their payment wallets in one place.
              </p>
            </div>
            <button
              className="primaryButton"
              onClick={() => setShowAdd((value) => !value)}
              disabled={profile?.accountStatus !== "active"}
            >
              Add partner
            </button>
          </header>

          {error ? <p className="errorText">{error}</p> : null}

          {showAdd ? (
            <section className="beneficiaryCreateCard">
              <div className="twoFields">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="ABC Logistics SRL"
                  />
                </label>

                <label className="field">
                  <span>Type</span>
                  <select
                    value={newType}
                    onChange={(event) =>
                      setNewType(event.target.value as PartnerType)
                    }
                  >
                    <option value="business">Business</option>
                    <option value="private">Private</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>First wallet</span>
                <input
                  value={newAddress}
                  onChange={(event) => setNewAddress(event.target.value.trim())}
                  placeholder="0x…"
                  autoComplete="off"
                />
              </label>

              <div className="actions">
                <button
                  className="primaryButton"
                  disabled={saving}
                  onClick={() => void addPartner()}
                >
                  {saving ? "Saving…" : "Save partner"}
                </button>
                <button
                  className="secondaryButton"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}

          <section className="beneficiaryAccordionList">
            {loading ? <p className="hint">Loading beneficiaries…</p> : null}

            {!loading && sortedPartners.length === 0 ? (
              <p className="hint">No saved beneficiaries yet.</p>
            ) : null}

            {sortedPartners.map((partner) => (
              <PartnerAccordion
                key={partner.id}
                partner={partner}
                saving={saving}
                readOnly={profile?.accountStatus !== "active"}
                selectedPaymentWallet={
                  paymentWallets[partner.id] ?? partner.wallets[0]?.address ?? ""
                }
                onPaymentWalletChange={(address) =>
                  setPaymentWallets((current) => ({
                    ...current,
                    [partner.id]: address,
                  }))
                }
                onSavePartner={savePartner}
                onAddWallet={addWallet}
                onSaveWallet={saveWallet}
                onRemoveWallet={removeWallet}
                onHistory={() => void openHistory(partner)}
                onPay={() => {
                  const address =
                    paymentWallets[partner.id] ?? partner.wallets[0]?.address;

                  if (!address) return;

                  router.push(
                    `/?payTo=${encodeURIComponent(address)}&partner=${encodeURIComponent(partner.id)}`,
                  );
                }}
              />
            ))}
          </section>
        </div>
      </main>

      {historyPartner ? (
        <div className="partnerModalBackdrop" role="presentation">
          <section
            className="partnerModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-history-title"
          >
            <div className="partnerModalHeader">
              <div>
                <p className="eyebrow">Payment history</p>
                <h2 id="partner-history-title">{historyPartner.name}</h2>
              </div>
              <button
                className="textButton"
                onClick={() => setHistoryPartner(null)}
              >
                Close
              </button>
            </div>

            {historyLoading ? <p className="hint">Loading payments…</p> : null}

            {!historyLoading && historyRecords.length === 0 ? (
              <p className="hint">No recorded payments to this partner yet.</p>
            ) : null}

            <div className="historyList">
              {historyRecords.map((record) => (
                <article className="historyRow" key={record.id}>
                  <div>
                    <strong>
                      {record.intent.destinationAmount ??
                        record.intent.sourceAmount}{" "}
                      {record.intent.destinationAsset.symbol}
                    </strong>
                    <span>To {shortAddress(record.intent.destination)}</span>
                    {record.intent.memo ? (
                      <span>{record.intent.memo}</span>
                    ) : null}
                  </div>

                  <div className="historyMeta">
                    <span>Settled</span>
                    <span>{new Date(record.settledAt).toLocaleString()}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PartnerAccordion({
  partner,
  saving,
  readOnly,
  selectedPaymentWallet,
  onPaymentWalletChange,
  onSavePartner,
  onAddWallet,
  onSaveWallet,
  onRemoveWallet,
  onHistory,
  onPay,
}: {
  partner: BeneficiaryPartner;
  saving: boolean;
  readOnly: boolean;
  selectedPaymentWallet: string;
  onPaymentWalletChange(address: string): void;
  onSavePartner(id: string, name: string, type: PartnerType): Promise<void>;
  onAddWallet(id: string, address: string): Promise<void>;
  onSaveWallet(id: string, walletId: string, address: string): Promise<void>;
  onRemoveWallet(id: string, walletId: string): Promise<void>;
  onHistory(): void;
  onPay(): void;
}) {
  const [name, setName] = useState(partner.name);
  const [type, setType] = useState<PartnerType>(partner.partnerType);
  const [newWallet, setNewWallet] = useState("");
  const [walletEdits, setWalletEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(partner.name);
    setType(partner.partnerType);
    setWalletEdits(
      Object.fromEntries(
        partner.wallets.map((wallet) => [wallet.id, wallet.address]),
      ),
    );
  }, [partner]);

  return (
    <details className="partnerAccordion">
      <summary className="partnerAccordionSummary">
        <div className="partnerSummaryIdentity">
          <strong>{partner.name}</strong>
          <span
            className={`partnerTypeBadge partnerType-${partner.partnerType}`}
          >
            {partner.partnerType === "business" ? "Business" : "Private"}
          </span>
        </div>

        <span className="partnerSummaryWallets">
          {partner.wallets.length}{" "}
          {partner.wallets.length === 1 ? "wallet" : "wallets"}
        </span>

        <span className="walletAccordionChevron" aria-hidden="true">
          ⌄
        </span>
      </summary>

      <div className="partnerAccordionBody">
        <div className="twoFields">
          <label className="field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={readOnly}
            />
          </label>

          <label className="field">
            <span>Type</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as PartnerType)
              }
              disabled={readOnly}
            >
              <option value="business">Business</option>
              <option value="private">Private</option>
            </select>
          </label>
        </div>

        <div className="actions">
          <button
            className="secondaryButton"
            disabled={readOnly || saving || !name.trim()}
            onClick={() =>
              void onSavePartner(partner.id, name.trim(), type)
            }
          >
            Save details
          </button>
        </div>

        <div className="partnerWalletSection">
          <p className="eyebrow">Wallets</p>

          {partner.wallets.map((wallet) => (
            <div className="partnerWalletRow" key={wallet.id}>
              <input
                value={walletEdits[wallet.id] ?? wallet.address}
                onChange={(event) =>
                  setWalletEdits((current) => ({
                    ...current,
                    [wallet.id]: event.target.value.trim(),
                  }))
                }
                disabled={readOnly}
                aria-label={`Wallet for ${partner.name}`}
              />

              <button
                className="secondaryButton"
                disabled={readOnly || saving}
                onClick={() =>
                  void onSaveWallet(
                    partner.id,
                    wallet.id,
                    walletEdits[wallet.id] ?? wallet.address,
                  )
                }
              >
                Save
              </button>

              <button
                className="textButton"
                disabled={readOnly || saving}
                onClick={() => void onRemoveWallet(partner.id, wallet.id)}
              >
                Remove
              </button>
            </div>
          ))}

          <div className="partnerWalletRow partnerWalletAddRow">
            <input
              value={newWallet}
              onChange={(event) => setNewWallet(event.target.value.trim())}
              placeholder="Add another wallet · 0x…"
              disabled={readOnly}
            />

            <button
              className="secondaryButton"
              disabled={readOnly || saving || !newWallet}
              onClick={() => {
                void onAddWallet(partner.id, newWallet).then(() =>
                  setNewWallet(""),
                );
              }}
            >
              Add wallet
            </button>
          </div>
        </div>

        <div className="partnerPaymentSection">
          <label className="field">
            <span>Payment wallet</span>
            <select
              value={selectedPaymentWallet}
              onChange={(event) => onPaymentWalletChange(event.target.value)}
              disabled={!partner.wallets.length}
            >
              {partner.wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.address}>
                  {shortAddress(wallet.address)}
                </option>
              ))}
            </select>
          </label>

          <div className="partnerAccordionActions">
            <button
              className="primaryButton"
              onClick={onPay}
              disabled={!partner.wallets.length}
            >
              Make payment to this partner
            </button>

            <button className="secondaryButton" onClick={onHistory}>
              Payment history
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
