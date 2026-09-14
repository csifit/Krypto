"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import BeneficiariesPanel from "@/components/BeneficiariesPanel";
import DashboardSidebar, { type SecondarySection } from "@/components/DashboardSidebar";
import PaymentHistory from "@/components/PaymentHistory";
import ReceivePanel from "@/components/ReceivePanel";
import SendPanel from "@/components/SendPanel";
import TestFundsPanel from "@/components/TestFundsPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { useCeloBalance } from "@/hooks/useCeloBalance";
import { useUsdtBalance } from "@/hooks/useUsdtBalance";
import { celoSepolia } from "@/lib/celo";
import {
  createBeneficiary,
  deleteBeneficiary,
  listBeneficiaries,
  syncProfile,
} from "@/lib/backend/client";
import type { Beneficiary } from "@/lib/payments/types";
import { createPrivyWalletProvider } from "@/lib/wallet/privy";

function shortAddress(address?: string) {
  if (!address) return "Not created yet";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatBalance(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export default function WalletDashboard() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SecondarySection>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const walletProvider = useMemo(() => {
    if (!embeddedWallet?.address) return undefined;
    return createPrivyWalletProvider(embeddedWallet, celoSepolia.id);
  }, [embeddedWallet]);

  const usdt = useUsdtBalance(walletProvider?.address);
  const celo = useCeloBalance(walletProvider?.address);

  useEffect(() => {
    const walletAddress = walletProvider?.address;

    if (!walletAddress) {
      setBeneficiaries([]);
      return;
    }

    let cancelled = false;

    async function loadBackend(address: `0x${string}`) {
      setBeneficiariesLoading(true);
      setBackendError(null);

      try {
        await syncProfile(getAccessToken, address);

        const next = await listBeneficiaries(getAccessToken);

        if (!cancelled) {
          setBeneficiaries(next);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendError(
            error instanceof Error
              ? error.message
              : "Could not connect to Krypto backend",
          );
        }
      } finally {
        if (!cancelled) {
          setBeneficiariesLoading(false);
        }
      }
    }

    void loadBackend(walletAddress);

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, walletProvider?.address]);

  async function addBeneficiary(name: string, address: `0x${string}`) {
    if (!walletProvider) return;
    const created = await createBeneficiary(getAccessToken, {
      name,
      address,
      walletAddress: walletProvider.address,
    });
    setBeneficiaries((current) => [...current, created]);
  }

  async function removeBeneficiary(id: string) {
    await deleteBeneficiary(getAccessToken, id);
    setBeneficiaries((current) => current.filter((item) => item.id !== id));
  }

  async function refreshAll() {
    await Promise.all([usdt.refresh(), celo.refresh()]);
    setHistoryRefreshKey((value) => value + 1);
  }

  async function copyWallet() {
    if (!walletProvider) return;
    await navigator.clipboard.writeText(walletProvider.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!ready || !walletsReady) {
    return (
      <main className="shell">
        <section className="panel">
          <p>Loading Krypto…</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="landingShell">
        <header className="landingHeader">
          <strong>Krypto</strong>
          <ThemeToggle compact />
        </header>

        <section className="landingHero">
          <p className="eyebrow">Krypto Business</p>
          <h1>One wallet. Smarter global payments.</h1>
          <p className="landingLead">
            Krypto finds the route. You approve the payment. Your funds stay under your control.
          </p>
          <button className="primaryButton landingCta" onClick={login}>
            Create account/Log in
          </button>

          <div className="advantageStrip" aria-label="Why Krypto">
            <span><strong>You control funds.</strong> Non-custodial wallet.</span>
            <span><strong>Krypto finds the route.</strong> Less payment complexity.</span>
            <span><strong>Costs are clear.</strong> Review before approval.</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="dashboardApp">
      <DashboardSidebar
        open={menuOpen}
        activeSection={activeSection}
        email={user?.email?.address}
        onClose={() => setMenuOpen(false)}
        onSelect={setActiveSection}
        onLogout={logout}
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
          <strong>Krypto</strong>
          <ThemeToggle compact />
        </header>

        <div className={activeSection ? "dashboardContent dashboardContentWithSide" : "dashboardContent"}>
          <div className="dashboardPrimary">
            <header className="dashboardHeading">
              <div>
                <p className="eyebrow">Krypto Business · Development</p>
                <h1 className="dashboardTitle">Overview</h1>
              </div>
            </header>

            <section className="dashboardCards">
              <article className="dashboardCard">
                <span className="cardLabel">My wallet</span>
                <strong className="walletAddressShort">{shortAddress(walletProvider?.address)}</strong>
                <div className="cardActionsCompact">
                  <button className="textButton" onClick={() => void copyWallet()} disabled={!walletProvider}>
                    {copied ? "Copied" : "Copy address"}
                  </button>
                  {walletProvider ? (
                    <a
                      className="textLink"
                      href={`https://celo-sepolia.blockscout.com/address/${walletProvider.address}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Explorer
                    </a>
                  ) : null}
                </div>
              </article>

              <article className="dashboardCard">
                <div className="cardHeaderCompact">
                  <span className="cardLabel">Balance</span>
                  <button className="textButton" onClick={() => void refreshAll()}>
                    Refresh
                  </button>
                </div>
                <strong className="balanceCompact">
                  {usdt.loading ? "…" : formatBalance(usdt.balance)}
                </strong>
                <span className="cardSubtle">USDTd · testnet</span>
              </article>

              <article className="dashboardCard">
                <span className="cardLabel">Send / Receive</span>
                <strong className="cardActionTitle">Move funds</strong>
                <div className="cardPrimaryActions">
                  <button
                    className="primaryButton"
                    disabled={!walletProvider}
                    onClick={() => {
                      setShowSend((value) => !value);
                      setShowReceive(false);
                    }}
                  >
                    Send
                  </button>
                  <button
                    className="secondaryButton"
                    disabled={!walletProvider}
                    onClick={() => {
                      setShowReceive((value) => !value);
                      setShowSend(false);
                    }}
                  >
                    Receive
                  </button>
                </div>
              </article>
            </section>

            {backendError ? <p className="errorText">Backend: {backendError}</p> : null}
            {usdt.error ? <p className="errorText">Balance error: {usdt.error}</p> : null}
            {celo.error ? <p className="errorText">Gas error: {celo.error}</p> : null}

            {showSend && walletProvider ? (
              <SendPanel
                wallet={walletProvider}
                balance={usdt.balance}
                beneficiaries={beneficiaries}
                onSent={refreshAll}
              />
            ) : null}

            {showReceive && walletProvider ? (
              <ReceivePanel address={walletProvider.address} />
            ) : null}
          </div>

          {activeSection ? (
            <aside className="secondarySideCard">
              <div className="sideCardHeader">
                <button className="textButton" onClick={() => setActiveSection(null)}>
                  Close
                </button>
              </div>

              {activeSection === "beneficiaries" && walletProvider ? (
                <BeneficiariesPanel
                  beneficiaries={beneficiaries}
                  loading={beneficiariesLoading}
                  onAdd={addBeneficiary}
                  onRemove={removeBeneficiary}
                />
              ) : null}

              {activeSection === "history" && walletProvider ? (
                <PaymentHistory refreshKey={historyRefreshKey} />
              ) : null}

              {activeSection === "developer" && walletProvider ? (
                <div className="developerSideContent">
                  <TestFundsPanel
                    wallet={walletProvider}
                    celoBalance={celo.balance}
                    onFunded={refreshAll}
                  />
                  <div className="developerFacts">
                    <div>
                      <span>Network</span>
                      <strong>Celo Sepolia</strong>
                    </div>
                    <div>
                      <span>Wallet provider</span>
                      <strong>Privy · replaceable</strong>
                    </div>
                    <div>
                      <span>Route</span>
                      <strong>Direct Celo</strong>
                    </div>
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
