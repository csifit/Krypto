"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnectWallet, useLinkAccount, usePrivy, useWallets } from "@privy-io/react-auth";
import { isAddress } from "viem";
import { ACTIVE_STABLECOINS } from "@/lib/assets";
import DashboardSidebar, { type SecondarySection } from "@/components/DashboardSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import WalletsPanel from "@/components/WalletsPanel";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { useBitcoinPortfolio } from "@/hooks/useBitcoinPortfolio";
import {
  createWatchWallet,
  deleteWalletLabel,
  deleteWatchWallet,
  listWalletLabels,
  listWatchWallets,
  saveWalletLabel,
  syncProfile,
  type AccountProfileSummary,
} from "@/lib/backend/client";
import type { LinkedWalletView, WalletLabel, WatchWallet } from "@/lib/wallet/directory";

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
  const [walletLabels, setWalletLabels] = useState<WalletLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfileSummary | null>(null);

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
    watchWallets
      .filter((wallet) => wallet.chainType === "ethereum" && isAddress(wallet.address))
      .forEach((wallet) => addresses.push(wallet.address as `0x${string}`));
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

  const bitcoinAddresses = useMemo(
    () => watchWallets.filter((wallet) => wallet.chainType === "bitcoin").map((wallet) => wallet.address),
    [watchWallets],
  );
  const bitcoinPortfolio = useBitcoinPortfolio(bitcoinAddresses, getAccessToken);

  const watchedBtcTotal = useMemo(() => {
    return bitcoinAddresses.reduce((total, address) => {
      const value = Number(bitcoinPortfolio.balances[address]?.balance ?? "0");
      return Number.isFinite(value) ? total + value : total;
    }, 0);
  }, [bitcoinAddresses, bitcoinPortfolio.balances]);

  const stablecoinTotals = useMemo(() => {
    const totals: Record<string, number> = Object.fromEntries(
      ACTIVE_STABLECOINS.map((asset) => [asset.symbol, 0]),
    );

    for (const address of ownedAddresses) {
      const snapshot = portfolio.balances[address.toLowerCase()];
      if (!snapshot) continue;
      for (const asset of ACTIVE_STABLECOINS) {
        const value = Number(snapshot.stablecoins[asset.symbol] ?? "0");
        if (Number.isFinite(value)) totals[asset.symbol] += value;
      }
    }

    return totals;
  }, [ownedAddresses, portfolio.balances]);

  useEffect(() => {
    if (!embeddedAddress) {
      setWatchWallets([]);
      setWalletLabels([]);
      setAccountProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setBackendError(null);

    void (async () => {
      try {
        const profileResult = await syncProfile(getAccessToken, embeddedAddress);
        const [nextWatchWallets, nextWalletLabels] = await Promise.all([
          listWatchWallets(getAccessToken),
          listWalletLabels(getAccessToken),
        ]);
        if (!cancelled) {
          setAccountProfile(profileResult.profile);
          setWatchWallets(nextWatchWallets);
          setWalletLabels(nextWalletLabels);
        }
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

  async function addWatchWallet(
    label: string,
    address: string,
    chainType: "ethereum" | "bitcoin",
  ) {
    const created = await createWatchWallet(getAccessToken, { label, address, chainType });
    setWatchWallets((current) => [...current, created]);
  }

  async function removeWatchWallet(id: string) {
    await deleteWatchWallet(getAccessToken, id);
    setWatchWallets((current) => current.filter((wallet) => wallet.id !== id));
  }

  const walletLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of walletLabels) {
      map[item.address.toLowerCase()] = item.label;
    }
    return map;
  }, [walletLabels]);

  async function renameWallet(address: `0x${string}`, label: string) {
    const saved = await saveWalletLabel(getAccessToken, { address, label });
    setWalletLabels((current) => {
      const key = address.toLowerCase();
      return [
        ...current.filter((item) => item.address.toLowerCase() !== key),
        saved,
      ];
    });
  }

  async function resetWalletName(address: `0x${string}`) {
    await deleteWalletLabel(getAccessToken, address);
    setWalletLabels((current) =>
      current.filter((item) => item.address.toLowerCase() !== address.toLowerCase()),
    );
  }

  function makePayment(address: `0x${string}`) {
    router.push(`/?payFrom=${encodeURIComponent(address)}`);
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

  const stablecoinSummary = ACTIVE_STABLECOINS
    .map((asset) => `${formatBalance(stablecoinTotals[asset.symbol] ?? 0)} ${asset.symbol}`)
    .join(" · ");

  return (
    <div className="dashboardApp">
      <DashboardSidebar
        open={menuOpen}
        activeSection="wallets"
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
              <strong>{portfolio.loading ? "…" : stablecoinSummary}</strong>
              <span>{ownedAddresses.length} owned {ownedAddresses.length === 1 ? "wallet" : "wallets"}</span>
              {bitcoinAddresses.length ? (
                <span className="walletPageBitcoinSummary">
                  {bitcoinPortfolio.loading ? "…" : watchedBtcTotal.toFixed(8)} BTC watched
                </span>
              ) : null}
            </div>
          </header>

          {backendError ? <p className="errorText">Backend: {backendError}</p> : null}

          {accountProfile && accountProfile.accountStatus !== "active" ? (
            <div className="accountRestrictionNotice" role="status">
              <strong>
                {accountProfile.accountStatus === "blocked"
                  ? "Krypto121 actions are blocked"
                  : "Krypto121 account changes are suspended"}
              </strong>
              <span>
                {accountProfile.statusReason ??
                  "Wallet-management changes and payments are temporarily unavailable."}
              </span>
            </div>
          ) : null}

          <WalletsPanel
            embeddedAddress={embeddedAddress}
            linkedWallets={linkedWallets}
            watchWallets={watchWallets}
            balances={portfolio.balances}
            bitcoinBalances={bitcoinPortfolio.balances}
            balancesLoading={portfolio.loading || bitcoinPortfolio.loading}
            loading={loading}
            linkStatus={linkStatus}
            onLinkExternal={linkExternalWallet}
            onConnectExternal={connectExternalWallet}
            onAddWatch={addWatchWallet}
            onRemoveWatch={removeWatchWallet}
            walletLabels={walletLabelMap}
            onRefreshBalances={async () => {
              await Promise.all([portfolio.refresh(), bitcoinPortfolio.refresh()]);
            }}
            onMakePayment={makePayment}
            onRenameWallet={renameWallet}
            onResetWalletName={resetWalletName}
            readOnly={!accountProfile || accountProfile.accountStatus !== "active"}
          />
        </div>
      </main>
    </div>
  );
}
