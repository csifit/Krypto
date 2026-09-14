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

type WalletRow = {
  id: string;
  label: string;
  address: `0x${string}`;
  badge: string;
  type: string;
  ownership: string;
  connection: string;
  provider: string;
  canPay: boolean;
  needsConnect: boolean;
  watchWalletId?: string;
  defaultLabel: string;
  renameable: boolean;
};

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
  walletLabels,
  onRefreshBalances,
  onMakePayment,
  onRenameWallet,
  onResetWalletName,
}: {
  embeddedAddress?: `0x${string}`;
  linkedWallets: LinkedWalletView[];
  watchWallets: WatchWallet[];
  balances: Record<string, WalletBalanceSnapshot>;
  balancesLoading: boolean;
  loading: boolean;
  linkStatus?: string | null;
  walletLabels: Record<string, string>;
  onLinkExternal(): void;
  onAddWatch(label: string, address: `0x${string}`): Promise<void>;
  onRemoveWatch(id: string): Promise<void>;
  onConnectExternal(): void;
  onRefreshBalances(): Promise<void>;
  onMakePayment(address: `0x${string}`): void;
  onRenameWallet(address: `0x${string}`, label: string): Promise<void>;
  onResetWalletName(address: `0x${string}`): Promise<void>;
}) {
  const [showWatchForm, setShowWatchForm] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [renamingAddress, setRenamingAddress] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const knownAddresses = useMemo(() => {
    const values = new Set<string>();
    if (embeddedAddress) values.add(embeddedAddress.toLowerCase());
    linkedWallets.forEach((wallet) => values.add(wallet.address.toLowerCase()));
    watchWallets.forEach((wallet) => values.add(wallet.address.toLowerCase()));
    return values;
  }, [embeddedAddress, linkedWallets, watchWallets, walletLabels]);

  const rows = useMemo<WalletRow[]>(() => {
    const result: WalletRow[] = [];

    if (embeddedAddress) {
      const defaultLabel = "Krypto121 wallet";
      result.push({
        id: `embedded-${embeddedAddress.toLowerCase()}`,
        label: walletLabels[embeddedAddress.toLowerCase()] ?? defaultLabel,
        defaultLabel,
        renameable: true,
        address: embeddedAddress,
        badge: "Active",
        type: "Krypto121 wallet",
        ownership: "User controlled",
        connection: "Ready for payments",
        provider: "Privy",
        canPay: true,
        needsConnect: false,
      });
    }

    for (const wallet of linkedWallets) {
      const defaultLabel = wallet.provider;
      result.push({
        id: `linked-${wallet.address.toLowerCase()}`,
        label: walletLabels[wallet.address.toLowerCase()] ?? defaultLabel,
        defaultLabel,
        renameable: true,
        address: wallet.address,
        badge: "Linked",
        type: "Linked wallet",
        ownership: "Ownership verified",
        connection: wallet.connected ? "Connected" : "Not connected",
        provider: wallet.provider,
        canPay: wallet.connected,
        needsConnect: !wallet.connected,
      });
    }

    for (const wallet of watchWallets) {
      result.push({
        id: `watch-${wallet.id}`,
        label: wallet.label,
        defaultLabel: wallet.label,
        renameable: false,
        address: wallet.address,
        badge: "Watch-only",
        type: "Watch-only wallet",
        ownership: "No ownership claim",
        connection: "View only",
        provider: "Address only",
        canPay: false,
        needsConnect: false,
        watchWalletId: wallet.id,
      });
    }

    return result;
  }, [embeddedAddress, linkedWallets, watchWallets, walletLabels]);

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
      setFormError("Enter a valid wallet address");
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

  async function copyAddress(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedAddress(value.toLowerCase());
    window.setTimeout(() => setCopiedAddress(null), 1400);
  }

  function startRename(wallet: WalletRow) {
    setRenamingAddress(wallet.address.toLowerCase());
    setRenameValue(wallet.label);
    setRenameError(null);
  }

  async function saveRename(wallet: WalletRow) {
    const next = renameValue.trim();

    if (!next) {
      setRenameError("Enter a wallet name");
      return;
    }

    if (next.length > 100) {
      setRenameError("Wallet name must be 100 characters or less");
      return;
    }

    setRenameSaving(true);
    setRenameError(null);

    try {
      await onRenameWallet(wallet.address, next);
      setRenamingAddress(null);
      setRenameValue("");
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : "Could not save wallet name",
      );
    } finally {
      setRenameSaving(false);
    }
  }

  async function resetRename(wallet: WalletRow) {
    setRenameSaving(true);
    setRenameError(null);

    try {
      await onResetWalletName(wallet.address);
      setRenamingAddress(null);
      setRenameValue("");
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : "Could not reset wallet name",
      );
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <section className="walletDirectory walletDirectoryPage">
      <div className="walletPageActions">
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
        <button
          className="textButton"
          onClick={() => void onRefreshBalances()}
          disabled={balancesLoading}
        >
          {balancesLoading ? "Refreshing…" : "Refresh balances"}
        </button>
      </div>

      {linkStatus ? <p className="walletActionStatus">{linkStatus}</p> : null}

      {showWatchForm ? (
        <form className="watchWalletForm walletPageWatchForm" onSubmit={submitWatch}>
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

      <div className="walletAccordionList">
        {rows.map((wallet) => {
          const snapshot = balances[wallet.address.toLowerCase()];
          const balanceText = snapshot?.error
            ? "Unavailable"
            : snapshot
              ? `${formatBalance(snapshot.usdt)} USDTd`
              : "Loading…";
          const networkReady = snapshot ? Number(snapshot.celo) > 0 : false;

          return (
            <details className="walletAccordion" key={wallet.id}>
              <summary className="walletAccordionSummary">
                <div className="walletSummaryIdentity">
                  <strong>{wallet.label}</strong>
                  <span className={wallet.badge === "Watch-only" ? "walletBadge walletBadgeQuiet" : "walletBadge"}>
                    {wallet.badge}
                  </span>
                </div>
                <span className="walletSummaryAddress">{shortAddress(wallet.address)}</span>
                <strong className="walletSummaryBalance">{balanceText}</strong>
                <span className="walletSummaryStatus">
                  {wallet.canPay ? "Ready" : wallet.needsConnect ? "Connect" : "View only"}
                </span>
                <span className="walletAccordionChevron" aria-hidden="true">⌄</span>
              </summary>

              <div className="walletAccordionBody">
                {wallet.renameable ? (
                  <div className="walletNameSection">
                    <div>
                      <span>Wallet name</span>
                      <strong>{wallet.label}</strong>
                    </div>

                    {renamingAddress === wallet.address.toLowerCase() ? (
                      <div className="walletRenameForm">
                        <input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          maxLength={100}
                          placeholder={wallet.defaultLabel}
                          aria-label="Wallet name"
                        />
                        <button
                          className="primaryButton"
                          type="button"
                          disabled={renameSaving}
                          onClick={() => void saveRename(wallet)}
                        >
                          {renameSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          className="secondaryButton"
                          type="button"
                          disabled={renameSaving}
                          onClick={() => {
                            setRenamingAddress(null);
                            setRenameError(null);
                          }}
                        >
                          Cancel
                        </button>
                        {wallet.label !== wallet.defaultLabel ? (
                          <button
                            className="textButton"
                            type="button"
                            disabled={renameSaving}
                            onClick={() => void resetRename(wallet)}
                          >
                            Use default name
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        className="textButton walletRenameButton"
                        type="button"
                        onClick={() => startRename(wallet)}
                      >
                        Rename
                      </button>
                    )}

                    {renamingAddress === wallet.address.toLowerCase() && renameError ? (
                      <p className="errorText walletRenameError">{renameError}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="walletDetailGrid">
                  <div>
                    <span>Wallet type</span>
                    <strong>{wallet.type}</strong>
                  </div>
                  <div>
                    <span>Full address</span>
                    <strong className="breakWord">{wallet.address}</strong>
                  </div>
                  <div>
                    <span>Ownership</span>
                    <strong>{wallet.ownership}</strong>
                  </div>
                  <div>
                    <span>Connection</span>
                    <strong>{wallet.connection}</strong>
                  </div>
                  <div>
                    <span>Balance</span>
                    <strong>{balanceText}</strong>
                  </div>
                  <div>
                    <span>Network fees</span>
                    <strong>
                      {wallet.type === "Watch-only wallet"
                        ? "Not applicable"
                        : snapshot?.error
                          ? "Unavailable"
                          : snapshot
                            ? networkReady ? "Ready" : "Needs funds"
                            : "Loading…"}
                    </strong>
                  </div>
                  <div>
                    <span>Provider</span>
                    <strong>{wallet.provider}</strong>
                  </div>
                  <div>
                    <span>Environment</span>
                    <strong>Test</strong>
                  </div>
                </div>

                <div className="walletAccordionActions">
                  <button
                    className="primaryButton"
                    onClick={() => onMakePayment(wallet.address)}
                    disabled={!wallet.canPay}
                  >
                    Make payment from this wallet
                  </button>

                  {wallet.needsConnect ? (
                    <button className="secondaryButton" onClick={onConnectExternal}>
                      Connect wallet
                    </button>
                  ) : null}

                  <button
                    className="secondaryButton"
                    onClick={() => void copyAddress(wallet.address)}
                  >
                    {copiedAddress === wallet.address.toLowerCase() ? "Copied" : "Copy address"}
                  </button>

                  {wallet.watchWalletId ? (
                    <button
                      className="textButton walletRemoveButton"
                      onClick={() => void onRemoveWatch(wallet.watchWalletId!)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                {!wallet.canPay ? (
                  <p className="walletDirectoryNote">
                    {wallet.needsConnect
                      ? "Connect this linked wallet before making a payment from it."
                      : "Watch-only wallets can be monitored, but they cannot sign or make payments."}
                  </p>
                ) : null}

                <div className="walletTechnicalLine">
                  <span>Technical:</span>
                  <strong>Celo Sepolia · Test USDT</strong>
                </div>
              </div>
            </details>
          );
        })}

        {!rows.length && !loading ? <p className="muted">No wallets yet.</p> : null}
        {loading ? <p className="muted walletPageLoading">Loading wallets…</p> : null}
      </div>

      <p className="walletDirectoryNote">
        Watch-only wallets are excluded from your owned balance and can never make payments.
      </p>
    </section>
  );
}
