"use client";

import { useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import ReceivePanel from "@/components/ReceivePanel";
import { useUsdtBalance } from "@/hooks/useUsdtBalance";
import { celoSepolia } from "@/lib/celo";
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
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [showReceive, setShowReceive] = useState(false);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const walletProvider = useMemo(() => {
    if (!embeddedWallet?.address) return undefined;
    return createPrivyWalletProvider(embeddedWallet.address, celoSepolia.id);
  }, [embeddedWallet?.address]);

  const { balance, loading, error, refresh } = useUsdtBalance(
    walletProvider?.address,
  );

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
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Krypto Business</p>
            <h1>Send digital dollars globally.</h1>
            <p className="lead">
              Start with a user-owned USDT wallet on Celo. No real funds are
              used in this development build.
            </p>
            <button className="primaryButton" onClick={login}>
              Create account
            </button>
          </div>
        </section>

        <section className="grid">
          <article className="panel">
            <span className="status">V1</span>
            <h2>USDT</h2>
            <p>Our first supported stablecoin.</p>
          </article>

          <article className="panel">
            <span className="status">Network</span>
            <h2>Celo Sepolia</h2>
            <p>Testnet only while we build the payment flow.</p>
          </article>

          <article className="panel">
            <span className="status">Custody</span>
            <h2>User controlled</h2>
            <p>Krypto does not need to hold the user&apos;s private key.</p>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Krypto Business</p>
          <h1 className="dashboardTitle">Account</h1>
        </div>
        <button className="secondaryButton" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="balanceCard">
        <div className="balanceHeader">
          <div>
            <p className="balanceLabel">Available balance</p>
            <p className="balance">
              {loading ? "…" : `${formatBalance(balance)} USDT`}
            </p>
            <p className="muted">Celo Sepolia testnet</p>
          </div>
          <button className="textButton" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {error ? <p className="errorText">Balance error: {error}</p> : null}

        <div className="actions">
          <button className="primaryButton" disabled>
            Send
          </button>
          <button
            className="secondaryButton"
            disabled={!walletProvider}
            onClick={() => setShowReceive((value) => !value)}
          >
            {showReceive ? "Hide receive" : "Receive"}
          </button>
        </div>

        <p className="hint">Send remains disabled until the next milestone.</p>
      </section>

      {showReceive && walletProvider ? (
        <ReceivePanel address={walletProvider.address} />
      ) : null}

      <section className="grid">
        <article className="panel">
          <span className="status">Wallet</span>
          <h2>{shortAddress(walletProvider?.address)}</h2>
          <p className="breakWord">{walletProvider?.address}</p>
          {walletProvider ? (
            <a
              className="inlineLink"
              href={`https://celo-sepolia.blockscout.com/address/${walletProvider.address}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in explorer
            </a>
          ) : null}
        </article>

        <article className="panel">
          <span className="status">Account</span>
          <h2>Authenticated</h2>
          <p>{user?.email?.address ?? "Privy user"}</p>
        </article>

        <article className="panel">
          <span className="status">Network</span>
          <h2>Celo Sepolia</h2>
          <p>Chain ID {celoSepolia.id}</p>
        </article>
      </section>
    </main>
  );
}
