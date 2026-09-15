"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import ThemeToggle from "@/components/ThemeToggle";
import {
  getAdminOverview,
  updateAdminSettings,
  updateAdminUserStatus,
  type AdminOverview,
} from "@/lib/backend/client";

function shortId(value?: string) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function UserControl({
  user,
  saving,
  onSave,
}: {
  user: AdminOverview["users"][number];
  saving: boolean;
  onSave(
    targetUserId: string,
    status: "active" | "suspended" | "blocked",
    reason?: string,
  ): Promise<void>;
}) {
  const [status, setStatus] = useState(user.accountStatus);
  const [reason, setReason] = useState(user.statusReason ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(user.accountStatus);
    setReason(user.statusReason ?? "");
  }, [user.accountStatus, user.statusReason]);

  async function save() {
    setError(null);
    if (status !== "active" && !reason.trim()) {
      setError("Add a reason before suspending or blocking this account.");
      return;
    }

    try {
      await onSave(user.privyUserId, status, reason.trim() || undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update account");
    }
  }

  return (
    <details className="adminUserRow">
      <summary>
        <div className="adminUserIdentity">
          <strong>{user.email ?? shortId(user.privyUserId)}</strong>
          <span>{user.walletAddress ? shortId(user.walletAddress) : "No wallet synced"}</span>
        </div>
        <span className={`adminStatusBadge adminStatus-${user.accountStatus}`}>
          {user.role === "super_admin" ? "Super admin" : user.accountStatus}
        </span>
      </summary>

      <div className="adminUserDetails">
        <div className="adminFactGrid">
          <div>
            <span>Role</span>
            <strong>{user.role === "super_admin" ? "Super admin" : "User"}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{formatDate(user.createdAt)}</strong>
          </div>
          <div>
            <span>User ID</span>
            <strong className="breakWord">{user.privyUserId}</strong>
          </div>
          <div>
            <span>Current reason</span>
            <strong>{user.statusReason ?? "None"}</strong>
          </div>
        </div>

        {user.role === "super_admin" ? (
          <p className="walletDirectoryNote">
            Super-admin status cannot be changed from this screen. This protects the emergency account from accidental lockout.
          </p>
        ) : (
          <div className="adminUserEditor">
            <label>
              <span>Account status</span>
              <select
                value={status}
                onChange={(event) => {
                  const nextStatus = event.target.value as "active" | "suspended" | "blocked";
                  setStatus(nextStatus);
                  if (nextStatus === "active" && user.accountStatus !== "active") {
                    setReason("");
                  }
                }}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label>
              <span>Reason {status === "active" ? "(optional)" : ""}</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={status === "active" ? "Issue resolved" : "Reason for intervention"}
                maxLength={250}
              />
            </label>
            {error ? <p className="errorText">{error}</p> : null}
            <div className="actions">
              <button
                className="primaryButton"
                onClick={() => void save()}
                disabled={saving || (status === user.accountStatus && reason === (user.statusReason ?? ""))}
              >
                {saving ? "Saving…" : status === "active" ? "Reactivate / save" : "Apply status"}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export default function AdminDashboard() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [mainnetPaymentsEnabled, setMainnetPaymentsEnabled] = useState(false);
  const [maxPaymentAmount, setMaxPaymentAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getAdminOverview(getAccessToken);
      setOverview(next);
      setPaymentsEnabled(next.settings.paymentsEnabled);
      setMainnetPaymentsEnabled(next.settings.mainnetPaymentsEnabled);
      setMaxPaymentAmount(next.settings.maxPaymentAmount ?? "");
    } catch (loadError) {
      setOverview(null);
      setError(loadError instanceof Error ? loadError.message : "Could not load administration");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void load();
  }, [ready, authenticated, load]);

  const activeUsers = useMemo(
    () => overview?.users.filter((item) => item.accountStatus === "active").length ?? 0,
    [overview?.users],
  );

  async function saveSettings() {
    setSavingSettings(true);
    setError(null);
    try {
      await updateAdminSettings(getAccessToken, {
        paymentsEnabled,
        mainnetPaymentsEnabled,
        maxPaymentAmount: maxPaymentAmount.trim() || null,
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save operational settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveUserStatus(
    targetUserId: string,
    status: "active" | "suspended" | "blocked",
    reason?: string,
  ) {
    setSavingUserId(targetUserId);
    try {
      await updateAdminUserStatus(getAccessToken, {
        targetUserId,
        status,
        reason,
      });
      await load();
    } finally {
      setSavingUserId(null);
    }
  }

  if (!ready) {
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
          <p className="eyebrow">Administration</p>
          <h1>Operational controls.</h1>
          <p className="landingLead">Super-admin access is required.</p>
          <button className="primaryButton landingCta" onClick={login}>Log in</button>
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <header className="adminTopbar">
        <div>
          <a className="textLink" href="/">← Dashboard</a>
          <h1>Administration</h1>
          <p>Emergency controls and operational visibility.</p>
        </div>
        <div className="adminTopbarActions">
          <ThemeToggle compact />
          <span>{user?.email?.address ?? "Super admin"}</span>
          <button className="secondaryButton" onClick={logout}>Sign out</button>
        </div>
      </header>

      {error ? <div className="adminErrorCard"><strong>{error}</strong></div> : null}
      {loading && !overview ? <section className="panel"><p>Loading operational controls…</p></section> : null}

      {overview ? (
        <div className="adminContent">
          <section className="adminSection">
            <div className="adminSectionHeader">
              <div>
                <p className="eyebrow">Operational safety</p>
                <h2>Payment controls</h2>
              </div>
              <span className="adminUpdated">Updated {formatDate(overview.settings.updatedAt)}</span>
            </div>

            <div className="adminControlGrid">
              <label className="adminToggleCard">
                <div>
                  <strong>Krypto121 payments</strong>
                  <span>Emergency global execution switch.</span>
                </div>
                <input
                  type="checkbox"
                  checked={paymentsEnabled}
                  onChange={(event) => setPaymentsEnabled(event.target.checked)}
                />
              </label>

              <label className="adminToggleCard">
                <div>
                  <strong>Mainnet payment gate</strong>
                  <span>Off by default. Turning this on alone does not enable mainnet code.</span>
                </div>
                <input
                  type="checkbox"
                  checked={mainnetPaymentsEnabled}
                  onChange={(event) => setMainnetPaymentsEnabled(event.target.checked)}
                />
              </label>

              <label className="adminLimitCard">
                <span>Maximum transaction amount</span>
                <input
                  value={maxPaymentAmount}
                  onChange={(event) => setMaxPaymentAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="No limit"
                />
                <small>Leave blank for no limit. No user limit is applied by default.</small>
              </label>
            </div>

            <div className="actions">
              <button className="primaryButton" onClick={() => void saveSettings()} disabled={savingSettings}>
                {savingSettings ? "Saving…" : "Save operational settings"}
              </button>
            </div>
          </section>

          <section className="adminSection">
            <div className="adminSectionHeader">
              <div>
                <p className="eyebrow">Infrastructure</p>
                <h2>RPC health</h2>
              </div>
              <button className="textButton" onClick={() => void load()} disabled={loading}>
                {loading ? "Checking…" : "Refresh"}
              </button>
            </div>

            <div className="adminRpcGrid">
              {overview.rpcHealth.map((rpc) => (
                <article className="adminRpcCard" key={rpc.role}>
                  <span>{rpc.role === "primary" ? "Primary RPC" : "Secondary RPC"}</span>
                  <strong>
                    {!rpc.configured ? "Not configured" : rpc.healthy ? "Healthy" : "Unavailable"}
                  </strong>
                  {rpc.healthy ? (
                    <small>{rpc.latencyMs} ms · block {rpc.blockNumber}</small>
                  ) : rpc.error ? (
                    <small>{rpc.error}</small>
                  ) : (
                    <small>Optional failover endpoint.</small>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="adminSection">
            <div className="adminSectionHeader">
              <div>
                <p className="eyebrow">Accounts</p>
                <h2>Users</h2>
              </div>
              <span className="adminUpdated">{activeUsers} active · {overview.users.length} total</span>
            </div>

            <div className="adminUserList">
              {overview.users.map((account) => (
                <UserControl
                  key={account.privyUserId}
                  user={account}
                  saving={savingUserId === account.privyUserId}
                  onSave={saveUserStatus}
                />
              ))}
            </div>
          </section>

          <section className="adminSection">
            <div className="adminSectionHeader">
              <div>
                <p className="eyebrow">Audit</p>
                <h2>Recent admin actions</h2>
              </div>
            </div>

            <div className="adminAuditList">
              {overview.audit.length ? overview.audit.map((item) => (
                <div className="adminAuditRow" key={item.id}>
                  <div>
                    <strong>{item.action}</strong>
                    <span>{item.targetUserId ? `Target ${shortId(item.targetUserId)}` : "Operational settings"}</span>
                  </div>
                  <time>{formatDate(item.createdAt)}</time>
                </div>
              )) : <p className="muted">No admin actions recorded yet.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
