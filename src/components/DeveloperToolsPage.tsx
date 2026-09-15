"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import BusinessApiPanel from "@/components/BusinessApiPanel";
import DashboardSidebar, {
  type SecondarySection,
} from "@/components/DashboardSidebar";
import TestFundsPanel from "@/components/TestFundsPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { useWalletPortfolio } from "@/hooks/useWalletPortfolio";
import { ACTIVE_STABLECOINS } from "@/lib/assets";
import {
  ACTIVE_CELO_CHAIN,
  ACTIVE_PAYMENT_NETWORK,
  IS_MAINNET,
  getAddressExplorerUrl,
} from "@/lib/celo";
import {
  getBusinessProfile,
  syncProfile,
  type AccountProfileSummary,
} from "@/lib/backend/client";
import type { BusinessProfile } from "@/lib/business/profile";
import { createPrivyWalletProvider } from "@/lib/wallet/privy";

export default function DeveloperToolsPage() {
  const router = useRouter();
  const {
    ready,
    authenticated,
    login,
    logout,
    user,
    getAccessToken,
  } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountProfile, setAccountProfile] =
    useState<AccountProfileSummary | null>(null);
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] =
    useState<string | null>(null);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const walletProvider = useMemo(() => {
    if (!embeddedWallet?.address) return undefined;

    return createPrivyWalletProvider(
      embeddedWallet,
      ACTIVE_CELO_CHAIN.id,
    );
  }, [embeddedWallet]);

  const portfolio = useWalletPortfolio(
    walletProvider
      ? [walletProvider.address]
      : [],
  );

  const embeddedBalance = walletProvider
    ? portfolio.balances[
        walletProvider.address.toLowerCase()
      ]
    : undefined;

  useEffect(() => {
    const address = walletProvider?.address;

    if (!address) {
      setAccountProfile(null);
      setBusinessProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setBackendError(null);

      try {
        const [profileResult, nextBusinessProfile] =
          await Promise.all([
            syncProfile(getAccessToken, address),
            getBusinessProfile(getAccessToken),
          ]);

        if (!cancelled) {
          setAccountProfile(profileResult.profile);
          setBusinessProfile(nextBusinessProfile);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendError(
            error instanceof Error
              ? error.message
              : "Could not load Developer tools",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken, walletProvider?.address]);

  function handleSidebar(section: SecondarySection) {
    if (section === "developer") return;

    if (section === "wallets") {
      router.push("/wallets");
      return;
    }

    if (section === "beneficiaries") {
      router.push("/beneficiaries");
      return;
    }

    if (section === null) {
      router.push("/");
      return;
    }

    router.push(`/?section=${section}`);
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
          <p className="eyebrow">Developer tools</p>
          <h1>Build with Krypto121.</h1>
          <p className="landingLead">
            Sign in to manage your Business API and
            technical payment settings.
          </p>

          <button
            className="primaryButton landingCta"
            onClick={login}
          >
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
        activeSection="developer"
        email={user?.email?.address}
        onClose={() => setMenuOpen(false)}
        onSelect={handleSidebar}
        onLogout={logout}
        isSuperAdmin={
          accountProfile?.role === "super_admin"
        }
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
              <p className="eyebrow">Integrations</p>
              <h1 className="dashboardTitle">
                Developer tools
              </h1>
              <p className="walletPageLead">
                API access and technical information for
                integrating Krypto121 into your business
                systems.
              </p>
            </div>
          </header>

          {backendError ? (
            <p className="errorText">
              Backend: {backendError}
            </p>
          ) : null}

          {accountProfile &&
          accountProfile.accountStatus !== "active" ? (
            <div
              className="accountRestrictionNotice"
              role="status"
            >
              <strong>
                Developer actions are unavailable
              </strong>
              <span>
                {accountProfile.statusReason ??
                  "This Krypto121 account is currently restricted."}
              </span>
            </div>
          ) : null}

          {loading ? (
            <p className="hint">
              Loading Developer tools…
            </p>
          ) : (
            <>
              <section className="businessPanel">
                <BusinessApiPanel
                  businessProfileReady={Boolean(
                    businessProfile,
                  )}
                  readOnly={
                    !accountProfile ||
                    accountProfile.accountStatus !== "active"
                  }
                />
              </section>

              <section className="businessPanel">
                <p className="eyebrow">
                  Technical environment
                </p>
                <h2>Payment infrastructure</h2>
                <p className="muted">
                  Technical details for development and
                  integration work.
                </p>

                <div className="developerFacts">
                  <div>
                    <span>Network</span>
                    <strong>
                      {ACTIVE_CELO_CHAIN.name}
                    </strong>
                  </div>

                  <div>
                    <span>Assets</span>
                    <strong>
                      {ACTIVE_STABLECOINS.map(
                        (asset) => asset.symbol,
                      ).join(" · ")}
                    </strong>
                  </div>

                  <div>
                    <span>Wallet provider</span>
                    <strong>
                      Privy · replaceable
                    </strong>
                  </div>

                  <div>
                    <span>Default direct route</span>
                    <strong>Direct Celo</strong>
                  </div>

                  {walletProvider ? (
                    <div>
                      <span>Wallet explorer</span>
                      <a
                        className="textLink"
                        href={getAddressExplorerUrl(
                          ACTIVE_PAYMENT_NETWORK,
                          walletProvider.address,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open technical view
                      </a>
                    </div>
                  ) : null}
                </div>
              </section>

              {!IS_MAINNET && walletProvider ? (
                <TestFundsPanel
                  wallet={walletProvider}
                  celoBalance={
                    embeddedBalance?.celo ?? "0"
                  }
                  onFunded={portfolio.refresh}
                />
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
