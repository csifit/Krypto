"use client";

import { useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import BeneficiariesPanel from "@/components/BeneficiariesPanel";
import PaymentHistory from "@/components/PaymentHistory";
import ReceivePanel from "@/components/ReceivePanel";
import SendPanel from "@/components/SendPanel";
import TestFundsPanel from "@/components/TestFundsPanel";
import { useCeloBalance } from "@/hooks/useCeloBalance";
import { useUsdtBalance } from "@/hooks/useUsdtBalance";
import { celoSepolia } from "@/lib/celo";
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
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const walletProvider = useMemo(() => {
    if (!embeddedWallet?.address) return undefined;
    return createPrivyWalletProvider(embeddedWallet, celoSepolia.id);
  }, [embeddedWallet]);

  const usdt = useUsdtBalance(walletProvider?.address);
  const celo = useCeloBalance(walletProvider?.address);

  async function refreshAll() {
    await Promise.all([usdt.refresh(), celo.refresh()]);
    setHistoryRefreshKey((value) => value + 1);
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
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Krypto Business</p>
            <h1>Send digital dollars globally.</h1>
            <p className="lead">
              Start with a user-owned stablecoin wallet on Celo. Development
              uses test tokens only; production remains USDT-first.
            </p>
            <button className="primaryButton" onClick={login}>
              Create account
            </button>
          </div>
        </section>

        <section className="grid">
          <article className="panel">
            <span className="status">V1 target</span>
            <h2>USDT</h2>
            <p>Our first production stablecoin.</p>
          </article>

          <article className="panel">
            <span className="status">Network</span>
            <h2>Celo</h2>
            <p>Celo Sepolia is used while we build the payment flow.</p>
          </article>

          <article className="panel">
            <span className="status">Router</span>
            <h2>Payment intents</h2>
            <p>Krypto chooses the settlement route; the user authorizes it.</p>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Krypto Business · Development</p>
          <h1 className="dashboardTitle">Account</h1>
        </div>
        <button className="secondaryButton" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="balanceCard">
        <div className="balanceHeader">
          <div>
            <p className="balanceLabel">Available test balance</p>
            <p className="balance">
              {usdt.loading ? "…" : `${formatBalance(usdt.balance)} USDTd`}
            </p>
            <p className="muted">Celo Sepolia · no real-world value</p>
          </div>
          <button className="textButton" onClick={() => void refreshAll()}>
            Refresh
          </button>
        </div>

        {usdt.error ? (
          <p className="errorText">Balance error: {usdt.error}</p>
        ) : null}
        {celo.error ? <p className="errorText">Gas error: {celo.error}</p> : null}

        <div className="actions">
          <button
            className="primaryButton"
            disabled={!walletProvider}
            onClick={() => {
              setShowSend((value) => !value);
              setShowReceive(false);
            }}
          >
            {showSend ? "Hide send" : "Send"}
          </button>
          <button
            className="secondaryButton"
            disabled={!walletProvider}
            onClick={() => {
              setShowReceive((value) => !value);
              setShowSend(false);
            }}
          >
            {showReceive ? "Hide receive" : "Receive"}
          </button>
        </div>
      </section>

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

      {walletProvider ? (
        <TestFundsPanel
          wallet={walletProvider}
          celoBalance={celo.balance}
          onFunded={refreshAll}
        />
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
          <span className="status">Router</span>
          <h2>Direct Celo</h2>
          <p>One route enabled. Krypto fee is 0 for development.</p>
        </article>
      </section>

      {walletProvider ? (
        <>
          <BeneficiariesPanel
            walletAddress={walletProvider.address}
            onChange={setBeneficiaries}
          />
          <PaymentHistory
            walletAddress={walletProvider.address}
            refreshKey={historyRefreshKey}
          />
        </>
      ) : null}
    </main>
  );
}
