"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { isAddress } from "viem";
import BeneficiariesPanel from "@/components/BeneficiariesPanel";
import DashboardSidebar, { type SecondarySection } from "@/components/DashboardSidebar";
import PaymentHistory from "@/components/PaymentHistory";
import ReceivePanel, { type ReceiveWalletOption } from "@/components/ReceivePanel";
import SendPanel from "@/components/SendPanel";
import TestFundsPanel from "@/components/TestFundsPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { ACTIVE_STABLECOINS } from "@/lib/assets";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_ENVIRONMENT_LABEL,
  ACTIVE_PAYMENT_NETWORK,
  ACTIVE_PRODUCT_LABEL,
  IS_MAINNET,
  getAddressExplorerUrl,
} from "@/lib/celo";
import {
  createBeneficiary,
  deleteBeneficiary,
  listBeneficiaries,
  listWalletLabels,
  syncProfile,
  type AccountProfileSummary,
} from "@/lib/backend/client";
import type { Beneficiary } from "@/lib/payments/types";
import type { PaymentRequest } from "@/lib/payments/paymentRequest";
import type { LinkedWalletView } from "@/lib/wallet/directory";
import { createPrivyWalletProvider } from "@/lib/wallet/privy";
import type { PaymentSourceWallet } from "@/lib/wallet/types";

function shortAddress(address?: string) {
  if (!address) return "Not created yet";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatBalance(value: string | number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

type LinkedWalletAccountLike = {
  type?: string;
  address?: string;
  walletClientType?: string;
  connectorType?: string;
};

function displayProvider(value?: string) {
  if (!value || value === "privy") return "External wallet";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function WalletDashboard({
  initialPaymentRequest,
}: {
  initialPaymentRequest?: PaymentRequest;
} = {}) {
  const router = useRouter();
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(Boolean(initialPaymentRequest));
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SecondarySection>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [walletLabels, setWalletLabels] = useState<Record<string, string>>({});
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [accountProfile, setAccountProfile] = useState<AccountProfileSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [initialSourceAddress, setInitialSourceAddress] = useState<`0x${string}` | undefined>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSource = params.get("payFrom");
    const requestedSection = params.get("section");

    if (requestedSource && isAddress(requestedSource)) {
      setInitialSourceAddress(requestedSource as `0x${string}`);
      setShowSend(true);
      setShowReceive(false);
    }

    if (requestedSection === "beneficiaries" || requestedSection === "history" || requestedSection === "developer") {
      setActiveSection(requestedSection);
    }
  }, []);

  function handleSidebar(section: SecondarySection) {
    if (section === "wallets") {
      router.push("/wallets");
      return;
    }
    setActiveSection(section);
  }

  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === "privy");

  const linkedWallets = useMemo<LinkedWalletView[]>(() => {
    const embeddedAddress = embeddedWallet?.address?.toLowerCase();
    const connectedByAddress = new Map(
      wallets.map((wallet) => [wallet.address.toLowerCase(), wallet]),
    );

    return ((user?.linkedAccounts ?? []) as LinkedWalletAccountLike[])
      .filter((account) => account.type === "wallet" || account.type === "smart_wallet")
      .filter((account) => Boolean(account.address) && isAddress(account.address!))
      .filter((account) => account.address!.toLowerCase() !== embeddedAddress)
      .map((account) => {
        const address = account.address as `0x${string}`;
        const connected = connectedByAddress.get(address.toLowerCase());
        return {
          address,
          provider: displayProvider(
            connected?.walletClientType || account.walletClientType || account.connectorType,
          ),
          connected: Boolean(connected),
        };
      })
      .filter(
        (wallet, index, all) =>
          all.findIndex((candidate) => candidate.address.toLowerCase() === wallet.address.toLowerCase()) === index,
      );
  }, [embeddedWallet?.address, user?.linkedAccounts, wallets]);

  const walletProvider = useMemo(() => {
    if (!embeddedWallet?.address) return undefined;
    return createPrivyWalletProvider(embeddedWallet, ACTIVE_CELO_CHAIN.id);
  }, [embeddedWallet]);

  const paymentSources = useMemo<PaymentSourceWallet[]>(() => {
    const sources: PaymentSourceWallet[] = [];

    if (embeddedWallet?.address) {
      sources.push({
        id: `embedded-${embeddedWallet.address.toLowerCase()}`,
        label: walletLabels[embeddedWallet.address.toLowerCase()] ?? "Krypto121 wallet",
        provider: "Privy",
        embedded: true,
        wallet: createPrivyWalletProvider(embeddedWallet, ACTIVE_CELO_CHAIN.id),
      });
    }

    for (const linked of linkedWallets) {
      if (!linked.connected) continue;

      const connected = wallets.find(
        (wallet) => wallet.address.toLowerCase() === linked.address.toLowerCase(),
      );
      if (!connected) continue;

      sources.push({
        id: `linked-${linked.address.toLowerCase()}`,
        label: walletLabels[linked.address.toLowerCase()] ?? linked.provider,
        provider: linked.provider,
        embedded: false,
        wallet: createPrivyWalletProvider(connected, ACTIVE_CELO_CHAIN.id),
      });
    }

    return sources;
  }, [embeddedWallet, linkedWallets, wallets, walletLabels]);

  const ownedWalletAddresses = useMemo<`0x${string}`[]>(() => {
    const addresses: `0x${string}`[] = [];
    if (embeddedWallet?.address) addresses.push(embeddedWallet.address as `0x${string}`);
    for (const wallet of linkedWallets) addresses.push(wallet.address);

    return addresses.filter(
      (address, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === address.toLowerCase()) === index,
    );
  }, [embeddedWallet?.address, linkedWallets]);

  const portfolio = useWalletPortfolio(ownedWalletAddresses);

  const stablecoinTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(
      ACTIVE_STABLECOINS.map((asset) => [asset.symbol, 0]),
    );

    for (const address of ownedWalletAddresses) {
      const snapshot = portfolio.balances[address.toLowerCase()];
      if (!snapshot) continue;

      for (const asset of ACTIVE_STABLECOINS) {
        const value = Number(snapshot.stablecoins[asset.symbol] ?? "0");
        if (Number.isFinite(value)) totals[asset.symbol] += value;
      }
    }

    return totals;
  }, [ownedWalletAddresses, portfolio.balances]);

  const balanceSummary = ACTIVE_STABLECOINS
    .map((asset) => `${formatBalance(stablecoinTotals[asset.symbol] ?? 0)} ${asset.symbol}`)
    .join(" · ");

  const embeddedBalance = walletProvider
    ? portfolio.balances[walletProvider.address.toLowerCase()]
    : undefined;

  const receiveWallets = useMemo<ReceiveWalletOption[]>(() => {
    const options: ReceiveWalletOption[] = [];

    if (embeddedWallet?.address) {
      options.push({
        id: `embedded-${embeddedWallet.address.toLowerCase()}`,
        label: walletLabels[embeddedWallet.address.toLowerCase()] ?? "Krypto121 wallet",
        address: embeddedWallet.address as `0x${string}`,
        detail: "Krypto121 wallet",
      });
    }

    for (const wallet of linkedWallets) {
      options.push({
        id: `linked-${wallet.address.toLowerCase()}`,
        label: walletLabels[wallet.address.toLowerCase()] ?? wallet.provider,
        address: wallet.address,
        detail: "Linked wallet",
      });
    }

    return options;
  }, [embeddedWallet?.address, linkedWallets, walletLabels]);

  useEffect(() => {
    const walletAddress = walletProvider?.address;

    if (!walletAddress) {
      setBeneficiaries([]);
      setWalletLabels({});
      setAccountProfile(null);
      return;
    }

    let cancelled = false;

    async function loadBackend(address: `0x${string}`) {
      setBeneficiariesLoading(true);
      setBackendError(null);

      try {
        const profileResult = await syncProfile(getAccessToken, address);

        const [nextBeneficiaries, nextWalletLabels] = await Promise.all([
          listBeneficiaries(getAccessToken),
          listWalletLabels(getAccessToken),
        ]);

        if (!cancelled) {
          setAccountProfile(profileResult.profile);
          setBeneficiaries(nextBeneficiaries);
          const labelMap: Record<string, string> = {};
          for (const item of nextWalletLabels) {
            labelMap[item.address.toLowerCase()] = item.label;
          }
          setWalletLabels(labelMap);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendError(
            error instanceof Error
              ? error.message
              : "Could not connect to Krypto121 backend",
          );
        }
      } finally {
        if (!cancelled) setBeneficiariesLoading(false);
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
    await portfolio.refresh();
    setHistoryRefreshKey((value) => value + 1);
  }

  async function copyWallet() {
    if (!walletProvider) return;
    await navigator.clipboard.writeText(walletProvider.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!ready || !walletsReady) {
    return <main className="shell"><section className="panel"><p>Loading Krypto121…</p></section></main>;
  }

  if (!authenticated) {
    return (
      <main className="landingShell">
        <header className="landingHeader">
          <strong>Krypto121</strong>
          <ThemeToggle compact />
        </header>
        <section className="landingHero">
          <p className="eyebrow">Krypto121</p>
          <h1>Krypto121 is a smart payment-routing wallet.</h1>
          <p className="landingLead">
            Create a wallet or bring the wallets you already use. Manage them from one place.
          </p>

          {initialPaymentRequest ? (
            <div className="incomingPaymentRequest">
              <span>Payment request</span>
              <strong>
                {initialPaymentRequest.amount
                  ? `${initialPaymentRequest.amount} ${initialPaymentRequest.asset}`
                  : `${initialPaymentRequest.asset} · amount to enter`}
              </strong>
              <small>To {shortAddress(initialPaymentRequest.recipient)}</small>
              {initialPaymentRequest.memo ? <small>Reference: {initialPaymentRequest.memo}</small> : null}
            </div>
          ) : null}

          <button className="primaryButton landingCta" onClick={login}>
            Create account/Log in
          </button>

          <div className="advantageStrip" aria-label="Why Krypto121">
            <span><strong>Your wallets.</strong> One dashboard.</span>
            <span><strong>Smart routing.</strong> Krypto121 finds the path.</span>
            <span><strong>You approve.</strong> Funds stay under your control.</span>
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
        onSelect={handleSidebar}
        onLogout={logout}
        isSuperAdmin={accountProfile?.role === "super_admin"}
      />

      <main className="dashboardMain">
        <header className="mobileTopbar">
          <button className="hamburgerButton" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <strong>Krypto121</strong>
          <ThemeToggle compact />
        </header>

        <div className={activeSection ? "dashboardContent dashboardContentWithSide" : "dashboardContent"}>
          <div className="dashboardPrimary">
            <header className="dashboardHeading">
              <div>
                <p className="eyebrow">Krypto121 · {ACTIVE_PRODUCT_LABEL}</p>
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
                </div>
              </article>

              <article className="dashboardCard">
                <div className="cardHeaderCompact">
                  <span className="cardLabel">Stablecoin balances</span>
                  <button className="textButton" onClick={() => void refreshAll()}>Refresh</button>
                </div>
                <strong className="balanceCompact">
                  {portfolio.loading ? "…" : balanceSummary}
                </strong>
                <span className="cardSubtle">
                  {ownedWalletAddresses.length} owned {ownedWalletAddresses.length === 1 ? "wallet" : "wallets"} · {ACTIVE_ENVIRONMENT_LABEL}
                </span>
              </article>

              <article className="dashboardCard">
                <span className="cardLabel">Send / Receive</span>
                <strong className="cardActionTitle">Move funds</strong>
                <div className="cardPrimaryActions">
                  <button
                    className="primaryButton"
                    disabled={!walletProvider || accountProfile?.accountStatus !== "active"}
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

            {accountProfile && accountProfile.accountStatus !== "active" ? (
              <div className="accountRestrictionNotice" role="status">
                <strong>
                  {accountProfile.accountStatus === "blocked"
                    ? "Krypto121 actions are blocked"
                    : "Krypto121 payments are suspended"}
                </strong>
                <span>
                  {accountProfile.statusReason ??
                    "Payment and account-changing actions are temporarily unavailable."}
                </span>
              </div>
            ) : null}

            {showSend && walletProvider && accountProfile?.accountStatus === "active" ? (
              <SendPanel
                accountWalletAddress={walletProvider.address}
                sourceWallets={paymentSources}
                beneficiaries={beneficiaries}
                initialRequest={initialPaymentRequest}
                initialSourceAddress={initialSourceAddress}
                onSent={refreshAll}
              />
            ) : null}

            {showReceive && walletProvider ? (
              <ReceivePanel wallets={receiveWallets} />
            ) : null}
          </div>

          {activeSection ? (
            <aside className="secondarySideCard">
              <div className="sideCardHeader">
                <button className="textButton" onClick={() => setActiveSection(null)}>Close</button>
              </div>

              {activeSection === "beneficiaries" && walletProvider ? (
                <BeneficiariesPanel
                  beneficiaries={beneficiaries}
                  loading={beneficiariesLoading}
                  onAdd={addBeneficiary}
                  onRemove={removeBeneficiary}
                  readOnly={!accountProfile || accountProfile.accountStatus !== "active"}
                />
              ) : null}

              {activeSection === "history" && walletProvider ? (
                <PaymentHistory refreshKey={historyRefreshKey} />
              ) : null}

              {activeSection === "developer" && walletProvider ? (
                <div className="developerSideContent">
                  {!IS_MAINNET ? (
                    <TestFundsPanel
                      wallet={walletProvider}
                      celoBalance={embeddedBalance?.celo ?? "0"}
                      onFunded={refreshAll}
                    />
                  ) : null}
                  <div className="developerFacts">
                    <div>
                      <span>Network</span>
                      <strong>{ACTIVE_CELO_CHAIN.name}</strong>
                    </div>
                    <div>
                      <span>Assets</span>
                      <strong>{ACTIVE_STABLECOINS.map((asset) => asset.symbol).join(" · ")}</strong>
                    </div>
                    <div>
                      <span>Wallet provider</span>
                      <strong>Privy · replaceable</strong>
                    </div>
                    <div>
                      <span>Route</span>
                      <strong>Direct Celo</strong>
                    </div>
                    <div>
                      <span>Wallet explorer</span>
                      <a
                        className="textLink"
                        href={getAddressExplorerUrl(ACTIVE_PAYMENT_NETWORK, walletProvider.address)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open technical view
                      </a>
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
