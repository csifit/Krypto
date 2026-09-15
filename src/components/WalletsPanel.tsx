"use client";

import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { looksLikeBitcoinMainnetAddress, watchAddressKey } from "@/lib/bitcoin/address";
import type { BitcoinBalanceSnapshot } from "@/hooks/useBitcoinPortfolio";
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
  address: string;
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
  chainType: "ethereum" | "bitcoin";
};

export default function WalletsPanel({
  embeddedAddress,
  linkedWallets,
  watchWallets,
  balances,
  bitcoinBalances,
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
  readOnly = false,
}: {
  embeddedAddress?: `0x${string}`;
  linkedWallets: LinkedWalletView[];
  watchWallets: WatchWallet[];
  balances: Record<string, WalletBalanceSnapshot>;
  bitcoinBalances: Record<string, BitcoinBalanceSnapshot>;
  balancesLoading: boolean;
  loading: boolean;
  linkStatus?: string | null;
  walletLabels: Record<string, string>;
  onLinkExternal(): void;
  onAddWatch(
    label: string,
    address: string,
    chainType: "ethereum" | "bitcoin",
  ): Promise<void>;
  onRemoveWatch(id: string): Promise<void>;
  onConnectExternal(): void;
  onRefreshBalances(): Promise<void>;
  onMakePayment(address: `0x${string}`): void;
  onRenameWallet(address: `0x${string}`, label: string): Promise<void>;
  onResetWalletName(address: `0x${string}`): Promise<void>;
  readOnly?: boolean;
}) {
  const [showWatchForm, setShowWatchForm] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [watchChainType, setWatchChainType] = useState<"ethereum" | "bitcoin">("ethereum");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [renamingAddress, setRenamingAddress] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const knownAddresses = useMemo(() => {
    const values = new Set<string>();
    if (embeddedAddress) values.add(watchAddressKey("ethereum", embeddedAddress));
    linkedWallets.forEach((wallet) =>
      values.add(watchAddressKey("ethereum", wallet.address)),
    );
    watchWallets.forEach((wallet) =>
      values.add(watchAddressKey(wallet.chainType, wallet.address)),
    );
    return values;
  }, [embeddedAddress, linkedWallets, watchWallets]);

  const rows = useMemo<WalletRow[]>(() => {
    const result: WalletRow[] = [];

    if (embeddedAddress) {
      const defaultLabel = "Krypto121 wallet";
      result.push({
        id: `embedded-${embeddedAddress.toLowerCase()}`,
        label: walletLabels[embeddedAddress.toLowerCase()] ?? defaultLabel,
        defaultLabel,
        renameable: true,
        chainType: "ethereum",
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
        chainType: "ethereum",
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
        chainType: wallet.chainType,
        address: wallet.address,
        badge: "Watch-only",
        type: wallet.chainType === "bitcoin" ? "Bitcoin watch-only" : "Watch-only wallet",
        ownership: "No ownership claim",
        connection: "View only",
        provider: wallet.chainType === "bitcoin" ? "Bitcoin network" : "Address only",
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

    if (watchChainType === "ethereum" && !isAddress(trimmedAddress)) {
      setFormError("Enter a valid stablecoin wallet address");
      return;
    }

    if (watchChainType === "bitcoin" && !looksLikeBitcoinMainnetAddress(trimmedAddress)) {
      setFormError("Enter a valid Bitcoin address");
      return;
    }

    if (knownAddresses.has(watchAddressKey(watchChainType, trimmedAddress))) {
      setFormError("That wallet is already in My wallets");
      return;
    }

    setSaving(true);
    try {
      await onAddWatch(trimmedLabel, trimmedAddress, watchChainType);
      setLabel("");
      setAddress("");
      setWatchChainType("ethereum");
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
      await onRenameWallet(wallet.address as `0x${string}`, next);
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
      await onResetWalletName(wallet.address as `0x${string}`);
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
          <button className="primaryButton" onClick={onLinkExternal} disabled={readOnly}>
            Link existing wallet
          </button>
          <button
            className="secondaryButton"
            disabled={readOnly}
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
            <span>Wallet type</span>
            <select
              value={watchChainType}
              onChange={(event) => {
                setWatchChainType(event.target.value as "ethereum" | "bitcoin");
                setAddress("");
                setFormError(null);
              }}
            >
              <option value="ethereum">Stablecoin wallet</option>
              <option value="bitcoin">Bitcoin wallet</option>
            </select>
          </label>
          <label>
            <span>Wallet address</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={watchChainType === "bitcoin" ? "bc1… / 1… / 3…" : "0x…"}
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
          const snapshot = wallet.chainType === "ethereum"
            ? balances[wallet.address.toLowerCase()]
            : undefined;
          const bitcoinSnapshot = wallet.chainType === "bitcoin"
            ? bitcoinBalances[wallet.address]
            : undefined;
          const balanceText = wallet.chainType === "bitcoin"
            ? bitcoinSnapshot?.error
              ? "Unavailable"
              : bitcoinSnapshot
                ? `${bitcoinSnapshot.balance} BTC`
                : "Loading…"
            : snapshot?.error
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
                          disabled={renameSaving || readOnly}
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
                            disabled={renameSaving || readOnly}
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
                    <span>{wallet.chainType === "bitcoin" ? "Network" : "Network fees"}</span>
                    <strong>
                      {wallet.chainType === "bitcoin"
                        ? "Bitcoin"
                        : wallet.type === "Watch-only wallet"
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
                    <strong>{wallet.chainType === "bitcoin" ? "Mainnet" : "Test"}</strong>
                  </div>
                </div>

                <div className="walletAccordionActions">
                  <button
                    className="primaryButton"
                    onClick={() => onMakePayment(wallet.address as `0x${string}`)}
                    disabled={!wallet.canPay || readOnly}
                  >
                    Make payment from this wallet
                  </button>

                  {wallet.needsConnect ? (
                    <button className="secondaryButton" onClick={onConnectExternal} disabled={readOnly}>
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
                      disabled={readOnly}
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

                {wallet.chainType === "bitcoin" ? (
                  <a
                    className="textLink walletBitcoinExplorer"
                    href={`https://mempool.space/address/${wallet.address}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Bitcoin explorer
                  </a>
                ) : null}

                <div className="walletTechnicalLine">
                  <span>Technical:</span>
                  <strong>
                    {wallet.chainType === "bitcoin"
                      ? "Bitcoin mainnet · Read only"
                      : "Celo Sepolia · Test USDT"}
                  </strong>
                </div>
              </div>
            </details>
          );
        })}

        {!rows.length && !loading ? <p className="muted">No wallets yet.</p> : null}
        {loading ? <p className="muted walletPageLoading">Loading wallets…</p> : null}
      </div>

      <p className="walletDirectoryNote">
        Watch-only wallets are excluded from your owned balance and can never make payments. Bitcoin support is currently view-only.
      </p>
    </section>
  );
}
