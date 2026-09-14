"use client";

import { useMemo, useState } from "react";
import { isAddress } from "viem";
import type { WalletBalanceSnapshot } from "@/hooks/useWalletPortfolio";
import type { LinkedWalletView, WatchWallet } from "@/lib/wallet/directory";

function shortAddress(address: string) {
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

function BalanceLines({
  address,
  balances,
  showNetworkFeeStatus = true,
}: {
  address: `0x${string}`;
  balances: Record<string, WalletBalanceSnapshot>;
  showNetworkFeeStatus?: boolean;
}) {
  const snapshot = balances[address.toLowerCase()];

  if (!snapshot) {
    return <span className="walletBalanceMuted">Balance loading…</span>;
  }

  if (snapshot.error) {
    return <span className="walletBalanceMuted">Balance unavailable</span>;
  }

  const hasNetworkFeeBalance = Number(snapshot.celo) > 0;

  return (
    <div className="walletBalanceLines">
      <span><strong>{formatBalance(snapshot.usdt)}</strong> USDTd</span>
      {showNetworkFeeStatus ? (
        <span>
          Network fees · <strong>{hasNetworkFeeBalance ? "Ready" : "Needs funds"}</strong>
        </span>
      ) : null}
    </div>
  );
}

export default function WalletsPanel({
  embeddedAddress,
  linkedWallets,
  watchWallets,
  balances,
  balancesLoading,
  loading,
  linkStatus,
  onLinkExternal,
  onAddWatch,
  onRemoveWatch,
  onConnectExternal,
  onRefreshBalances,
}: {
  embeddedAddress?: `0x${string}`;
  linkedWallets: LinkedWalletView[];
  watchWallets: WatchWallet[];
  balances: Record<string, WalletBalanceSnapshot>;
  balancesLoading: boolean;
  loading: boolean;
  linkStatus?: string | null;
  onLinkExternal(): void;
  onAddWatch(label: string, address: `0x${string}`): Promise<void>;
  onRemoveWatch(id: string): Promise<void>;
  onConnectExternal(): void;
  onRefreshBalances(): Promise<void>;
}) {
  const [showWatchForm, setShowWatchForm] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const knownAddresses = useMemo(() => {
    const values = new Set<string>();
    if (embeddedAddress) values.add(embeddedAddress.toLowerCase());
    linkedWallets.forEach((wallet) => values.add(wallet.address.toLowerCase()));
    watchWallets.forEach((wallet) => values.add(wallet.address.toLowerCase()));
    return values;
  }, [embeddedAddress, linkedWallets, watchWallets]);

  async function submitWatch(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedLabel = label.trim();
    const trimmedAddress = address.trim();

    if (!trimmedLabel) {
      setFormError("Enter a wallet label");
      return;
    }

    if (!isAddress(trimmedAddress)) {
      setFormError("Enter a valid EVM wallet address");
      return;
    }

    if (knownAddresses.has(trimmedAddress.toLowerCase())) {
      setFormError("That wallet is already in My wallets");
      return;
    }

    setSaving(true);
    try {
      await onAddWatch(trimmedLabel, trimmedAddress as `0x${string}`);
      setLabel("");
      setAddress("");
      setShowWatchForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save wallet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="walletDirectory">
      <div className="walletDirectoryHeader">
        <div>
          <p className="eyebrow">Wallet directory</p>
          <h2>My wallets</h2>
        </div>
        <button
          className="textButton"
          onClick={() => void onRefreshBalances()}
          disabled={balancesLoading}
        >
          {balancesLoading ? "Refreshing…" : "Refresh balances"}
        </button>
      </div>

      <p className="muted walletDirectoryIntro">
        Link wallets you control or save an address as watch-only. Krypto121 reads wallet balances without taking custody.
      </p>

      <div className="walletDirectoryActions">
        <button className="primaryButton" onClick={onLinkExternal}>
          Link existing wallet
        </button>
        <button
          className="secondaryButton"
          onClick={() => {
            setShowWatchForm((value) => !value);
            setFormError(null);
          }}
        >
          Add watch-only
        </button>
      </div>

      {linkStatus ? <p className="walletActionStatus">{linkStatus}</p> : null}

      {showWatchForm ? (
        <form className="watchWalletForm" onSubmit={submitWatch}>
          <label>
            <span>Label</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Company treasury"
              maxLength={100}
            />
          </label>
          <label>
            <span>Wallet address</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          {formError ? <p className="errorText">{formError}</p> : null}
          <div className="walletDirectoryActions">
            <button className="primaryButton" disabled={saving} type="submit">
              {saving ? "Saving…" : "Save wallet"}
            </button>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setShowWatchForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="walletList">
        {embeddedAddress ? (
          <article className="walletListItem">
            <div>
              <div className="walletListTitleRow">
                <strong>Krypto121 wallet</strong>
                <span className="walletBadge">Active</span>
              </div>
              <span className="walletListAddress">{shortAddress(embeddedAddress)}</span>
              <BalanceLines address={embeddedAddress} balances={balances} />
            </div>
            <div className="walletListMeta">
              <span>Embedded</span>
              <span>User controlled</span>
            </div>
          </article>
        ) : null}

        {linkedWallets.map((wallet) => (
          <article className="walletListItem" key={`linked-${wallet.address}`}>
            <div>
              <div className="walletListTitleRow">
                <strong>{wallet.provider}</strong>
                <span className="walletBadge">Linked</span>
              </div>
              <span className="walletListAddress">{shortAddress(wallet.address)}</span>
              <BalanceLines address={wallet.address} balances={balances} />
            </div>
            <div className="walletListMeta">
              <span>Ownership verified</span>
              {wallet.connected ? (
                <span>Connected now</span>
              ) : (
                <button className="textButton" onClick={onConnectExternal}>
                  Connect for payment
                </button>
              )}
            </div>
          </article>
        ))}

        {watchWallets.map((wallet) => (
          <article className="walletListItem" key={`watch-${wallet.id}`}>
            <div>
              <div className="walletListTitleRow">
                <strong>{wallet.label}</strong>
                <span className="walletBadge walletBadgeQuiet">Watch-only</span>
              </div>
              <span className="walletListAddress">{shortAddress(wallet.address)}</span>
              <BalanceLines address={wallet.address} balances={balances} showNetworkFeeStatus={false} />
            </div>
            <div className="walletListMeta">
              <span>View only · excluded from owned total</span>
              <button
                className="textButton"
                onClick={() => void onRemoveWatch(wallet.id)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}

        {!embeddedAddress && linkedWallets.length === 0 && watchWallets.length === 0 && !loading ? (
          <p className="muted">No wallets yet.</p>
        ) : null}

        {loading ? <p className="muted">Loading wallets…</p> : null}
      </div>

      <p className="walletDirectoryNote">
        Owned balance totals include the embedded wallet and verified linked wallets. Watch-only wallets are monitored separately and can never sign or move funds.
      </p>
    </section>
  );
}
