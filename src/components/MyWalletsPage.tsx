"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnectWallet, useLinkAccount, usePrivy, useWallets } from "@privy-io/react-auth";
import { isAddress } from "viem";
import DashboardSidebar, { type SecondarySection } from "@/components/DashboardSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import WalletsPanel from "@/components/WalletsPanel";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import {
  createWatchWallet,
  deleteWatchWallet,
  listWatchWallets,
  syncProfile,
} from "@/lib/backend/client";
import type { LinkedWalletView, WatchWallet } from "@/lib/wallet/directory";

function formatBalance(value: number) {
  return value.toLocaleString(undefined, {
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

export default function MyWalletsPage() {
  const router = useRouter();
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchWallets, setWatchWallets] = useState<WatchWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);

  const { linkWallet } = useLinkAccount({
    onSuccess: () => setLinkStatus("Wallet linked to your Krypto121 account."),
    onError: (error) => setLinkStatus(error || "Could not link wallet"),
  });
  const { connectWallet } = useConnectWallet();

  const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === "privy");
  const embeddedAddress = embeddedWallet?.address as `0x${string}` | undefined;

  const linkedWallets = useMemo<LinkedWalletView[]>(() => {
    const embedded = embeddedAddress?.toLowerCase();
    const connectedByAddress = new Map(
      wallets.map((wallet) => [wallet.address.toLowerCase(), wallet]),
    );

    return ((user?.linkedAccounts ?? []) as LinkedWalletAccountLike[])
      .filter((account) => account.type === "wallet" || account.type === "smart_wallet")
      .filter((account) => Boolean(account.address) && isAddress(account.address!))
      .filter((account) => account.address!.toLowerCase() !== embedded)
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
  }, [embeddedAddress, user?.linkedAccounts, wallets]);

  const trackedAddresses = useMemo<`0x${string}`[]>(() => {
    const addresses: `0x${string}`[] = [];
    if (embeddedAddress) addresses.push(embeddedAddress);
    linkedWallets.forEach((wallet) => addresses.push(wallet.address));
    watchWallets.forEach((wallet) => addresses.push(wallet.address));
    return addresses.filter(
      (address, index, all) =>
        all.findIndex((candidate) => candidate.toLowerCase() === address.toLowerCase()) === index,
    );
  }, [embeddedAddress, linkedWallets, watchWallets]);

  const ownedAddresses = useMemo<`0x${string}`[]>(() => {
    const addresses: `0x${string}`[] = [];
    if (embeddedAddress) addresses.push(embeddedAddress);
    linkedWallets.forEach((wallet) => addresses.push(wallet.address));
    return addresses;
  }, [embeddedAddress, linkedWallets]);

  const portfolio = useWalletPortfolio(trackedAddresses);

  const ownedTotal = useMemo(() => {
    return ownedAddresses.reduce((total, address) => {
      const value = Number(portfolio.balances[address.toLowerCase()]?.usdt ?? "0");
      return Number.isFinite(value) ? total + value : total;
    }, 0);
  }, [ownedAddresses, portfolio.balances]);

  useEffect(() => {
    if (!embeddedAddress) {
      setWatchWallets([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setBackendError(null);

    void (async () => {
      try {
        await syncProfile(getAccessToken, embeddedAddress);
        const next = await listWatchWallets(getAccessToken);
        if (!cancelled) setWatchWallets(next);
      } catch (error) {
        if (!cancelled) {
          setBackendError(
            error instanceof Error ? error.message : "Could not load My wallets",
          );
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
    if (section === "wallets") return;
    if (section === null) {
      router.push("/");
      return;
    }
    router.push(`/?section=${section}`);
  }

  function linkExternalWallet() {
    setLinkStatus("Connect and verify the wallet you want to add.");
    linkWallet();
  }

  function connectExternalWallet() {
    setLinkStatus("Connect your linked wallet to use it for payments.");
    connectWallet();
  }

  async function addWatchWallet(label: string, address: `0x${string}`) {
    const created = await createWatchWallet(getAccessToken, { label, address });
    setWatchWallets((current) => [...current, created]);
  }

  async function removeWatchWallet(id: string) {
    await deleteWatchWallet(getAccessToken, id);
    setWatchWallets((current) => current.filter((wallet) => wallet.id !== id));
  }

  function makePayment(address: `0x${string}`) {
    router.push(`/?payFrom=${encodeURIComponent(address)}`);
  }

  if (!ready || !walletsReady) {
    return (
      <main className="shell">
        <section className="panel"><p>Loading Krypto121…</p></section>
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
          <p className="eyebrow">My wallets</p>
          <h1>Manage your wallets in one place.</h1>
          <p className="landingLead">Sign in to view linked and watch-only wallets.</p>
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
        activeSection="wallets"
        email={user?.email?.address}
        onClose={() => setMenuOpen(false)}
        onSelect={handleSidebar}
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

        <div className="dashboardContent walletPageContent">
          <header className="walletPageHeader">
            <div>
              <p className="eyebrow">Wallet management</p>
              <h1 className="dashboardTitle">My wallets</h1>
              <p className="walletPageLead">
                Your Krypto121 wallet, linked wallets and watch-only addresses in one place.
              </p>
            </div>
            <div className="walletPageSummary">
              <strong>{portfolio.loading ? "…" : formatBalance(ownedTotal)} USDTd</strong>
              <span>{ownedAddresses.length} owned {ownedAddresses.length === 1 ? "wallet" : "wallets"}</span>
            </div>
          </header>

          {backendError ? <p className="errorText">Backend: {backendError}</p> : null}

          <WalletsPanel
            embeddedAddress={embeddedAddress}
            linkedWallets={linkedWallets}
            watchWallets={watchWallets}
            balances={portfolio.balances}
            balancesLoading={portfolio.loading}
            loading={loading}
            linkStatus={linkStatus}
            onLinkExternal={linkExternalWallet}
            onConnectExternal={connectExternalWallet}
            onAddWatch={addWatchWallet}
            onRemoveWatch={removeWatchWallet}
            onRefreshBalances={portfolio.refresh}
            onMakePayment={makePayment}
          />
        </div>
      </main>
    </div>
  );
}
