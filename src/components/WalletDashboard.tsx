"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnectWallet, useLinkAccount, usePrivy, useWallets } from "@privy-io/react-auth";
import { isAddress } from "viem";
import BeneficiariesPanel from "@/components/BeneficiariesPanel";
import DashboardSidebar, { type SecondarySection } from "@/components/DashboardSidebar";
import PaymentHistory from "@/components/PaymentHistory";
import ReceivePanel, { type ReceiveWalletOption } from "@/components/ReceivePanel";
import SendPanel from "@/components/SendPanel";
import TestFundsPanel from "@/components/TestFundsPanel";
import ThemeToggle from "@/components/ThemeToggle";
import WalletsPanel from "@/components/WalletsPanel";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { celoSepolia } from "@/lib/celo";
import {
  createBeneficiary,
  createWatchWallet,
  deleteBeneficiary,
  deleteWatchWallet,
  listBeneficiaries,
  listWatchWallets,
  syncProfile,
} from "@/lib/backend/client";
import type { Beneficiary } from "@/lib/payments/types";
import type { LinkedWalletView, WatchWallet } from "@/lib/wallet/directory";
import { createPrivyWalletProvider } from "@/lib/wallet/privy";
import type { PaymentSourceWallet } from "@/lib/wallet/types";

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

export default function WalletDashboard() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SecondarySection>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [watchWallets, setWatchWallets] = useState<WatchWallet[]>([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletLinkStatus, setWalletLinkStatus] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const { linkWallet } = useLinkAccount({
    onSuccess: () => {
      setWalletLinkStatus("Wallet linked to your Krypto121 account.");
    },
    onError: (error) => {
      setWalletLinkStatus(error || "Could not link wallet");
    },
  });

  const { connectWallet } = useConnectWallet();

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

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
    return createPrivyWalletProvider(embeddedWallet, celoSepolia.id);
  }, [embeddedWallet]);

  const paymentSources = useMemo<PaymentSourceWallet[]>(() => {
    const sources: PaymentSourceWallet[] = [];

    if (embeddedWallet?.address) {
      sources.push({
        id: `embedded-${embeddedWallet.address.toLowerCase()}`,
        label: "Krypto121 wallet",
        provider: "Privy",
        embedded: true,
        wallet: createPrivyWalletProvider(embeddedWallet, celoSepolia.id),
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
        label: linked.provider,
        provider: linked.provider,
        embedded: false,
        wallet: createPrivyWalletProvider(connected, celoSepolia.id),
      });
    }

    return sources;
  }, [embeddedWallet, linkedWallets, wallets]);

  const ownedWalletAddresses = useMemo<`0x${string}`[]>(() => {
    const addresses: `0x${string}`[] = [];
    if (embeddedWallet?.address) addresses.push(embeddedWallet.address as `0x${string}`);
    for (const wallet of linkedWallets) addresses.push(wallet.address);

    return addresses.filter(
      (address, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === address.toLowerCase()) === index,
    );
  }, [embeddedWallet?.address, linkedWallets]);

  const trackedWalletAddresses = useMemo<`0x${string}`[]>(() => {
    const addresses = [...ownedWalletAddresses, ...watchWallets.map((wallet) => wallet.address)];
    return addresses.filter(
      (address, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === address.toLowerCase()) === index,
    );
  }, [ownedWalletAddresses, watchWallets]);

  const portfolio = useWalletPortfolio(trackedWalletAddresses);

  const ownedUsdtTotal = useMemo(() => {
    return ownedWalletAddresses.reduce((total, address) => {
      const balance = portfolio.balances[address.toLowerCase()]?.usdt ?? "0";
      const number = Number(balance);
      return Number.isFinite(number) ? total + number : total;
    }, 0);
  }, [ownedWalletAddresses, portfolio.balances]);

  const embeddedBalance = walletProvider
    ? portfolio.balances[walletProvider.address.toLowerCase()]
    : undefined;

  const receiveWallets = useMemo<ReceiveWalletOption[]>(() => {
    const options: ReceiveWalletOption[] = [];

    if (embeddedWallet?.address) {
      options.push({
        id: `embedded-${embeddedWallet.address.toLowerCase()}`,
        label: "Krypto121 wallet",
        address: embeddedWallet.address as `0x${string}`,
        detail: "Krypto121 wallet",
      });
    }

    for (const wallet of linkedWallets) {
      options.push({
        id: `linked-${wallet.address.toLowerCase()}`,
        label: wallet.provider,
        address: wallet.address,
        detail: "Linked wallet",
      });
    }

    return options;
  }, [embeddedWallet?.address, linkedWallets]);

  useEffect(() => {
    const walletAddress = walletProvider?.address;

    if (!walletAddress) {
      setBeneficiaries([]);
      setWatchWallets([]);
      return;
    }

    let cancelled = false;

    async function loadBackend(address: `0x${string}`) {
      setBeneficiariesLoading(true);
      setWalletsLoading(true);
      setBackendError(null);

      try {
        await syncProfile(getAccessToken, address);

        const [nextBeneficiaries, nextWatchWallets] = await Promise.all([
          listBeneficiaries(getAccessToken),
          listWatchWallets(getAccessToken),
        ]);

        if (!cancelled) {
          setBeneficiaries(nextBeneficiaries);
          setWatchWallets(nextWatchWallets);
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
        if (!cancelled) {
          setBeneficiariesLoading(false);
          setWalletsLoading(false);
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

  async function addWatchWallet(label: string, address: `0x${string}`) {
    const created = await createWatchWallet(getAccessToken, { label, address });
    setWatchWallets((current) => [...current, created]);
  }

  async function removeWatchWallet(id: string) {
    await deleteWatchWallet(getAccessToken, id);
    setWatchWallets((current) => current.filter((item) => item.id !== id));
  }

  function linkExternalWallet() {
    setWalletLinkStatus("Connect and verify the wallet you want to add.");
    linkWallet();
  }

  function connectExternalWallet() {
    setWalletLinkStatus("Connect a linked wallet to use it for payments in this session.");
    connectWallet();
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
          <p className="eyebrow">Krypto121</p>
          <h1>Krypto121 is a smart payment-routing wallet.</h1>
          <p className="landingLead">
            Create a wallet or bring the wallets you already use. Manage them from one place.
          </p>
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
          <strong>Krypto121</strong>
          <ThemeToggle compact />
        </header>

        <div className={activeSection ? "dashboardContent dashboardContentWithSide" : "dashboardContent"}>
          <div className="dashboardPrimary">
            <header className="dashboardHeading">
              <div>
                <p className="eyebrow">Krypto121 · Development</p>
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
                  <span className="cardLabel">Balance</span>
                  <button className="textButton" onClick={() => void refreshAll()}>
                    Refresh
                  </button>
                </div>
                <strong className="balanceCompact">
                  {portfolio.loading ? "…" : formatBalance(String(ownedUsdtTotal))}
                </strong>
                <span className="cardSubtle">
                  USDTd · {ownedWalletAddresses.length} owned {ownedWalletAddresses.length === 1 ? "wallet" : "wallets"} · testnet
                </span>
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

            {showSend && walletProvider ? (
              <SendPanel
                accountWalletAddress={walletProvider.address}
                sourceWallets={paymentSources}
                beneficiaries={beneficiaries}
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
                <button className="textButton" onClick={() => setActiveSection(null)}>
                  Close
                </button>
              </div>

              {activeSection === "wallets" ? (
                <WalletsPanel
                  embeddedAddress={walletProvider?.address}
                  linkedWallets={linkedWallets}
                  watchWallets={watchWallets}
                  balances={portfolio.balances}
                  balancesLoading={portfolio.loading}
                  loading={walletsLoading}
                  linkStatus={walletLinkStatus}
                  onLinkExternal={linkExternalWallet}
                  onConnectExternal={connectExternalWallet}
                  onAddWatch={addWatchWallet}
                  onRemoveWatch={removeWatchWallet}
                  onRefreshBalances={portfolio.refresh}
                />
              ) : null}

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
                    celoBalance={embeddedBalance?.celo ?? "0"}
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
                    <div>
                      <span>Wallet explorer</span>
                      <a
                        className="textLink"
                        href={`https://celo-sepolia.blockscout.com/address/${walletProvider.address}`}
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
