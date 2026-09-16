"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import DashboardSidebar, {
  type SecondarySection,
} from "@/components/DashboardSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "@/components/FiatPage.module.css";
import {
  createFiatQuote,
  createFiatSession,
  getFiatOptions,
  readFiatSession,
  type FiatUiAsset,
  type FiatUiQuote,
} from "@/lib/fiat/client";
import type {
  FiatProviderPaymentMethod,
  FiatRouteDirection,
  FiatSessionStatus,
} from "@/lib/fiat/types";
import {
  getBusinessProfile,
  syncProfile,
  type AccountProfileSummary,
} from "@/lib/backend/client";
import type { BusinessProfile } from "@/lib/business/profile";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function statusLabel(status: FiatSessionStatus) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  if (status === "awaiting-user") return "Waiting for completion";
  return "Processing";
}

export default function FiatPage() {
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
  const [profile, setProfile] = useState<AccountProfileSummary | null>(null);
  const [businessProfile, setBusinessProfile] =
    useState<BusinessProfile | null>(null);

  const [direction, setDirection] =
    useState<FiatRouteDirection>("fiat-to-crypto");
  const [countries, setCountries] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [subdivisionCode, setSubdivisionCode] = useState("");
  const [suggestedSubdivision, setSuggestedSubdivision] = useState("");
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [fiatCurrency, setFiatCurrency] = useState("");
  const [assets, setAssets] = useState<FiatUiAsset[]>([]);
  const [cryptoAssetKey, setCryptoAssetKey] = useState("");
  const [paymentMethods, setPaymentMethods] =
    useState<FiatProviderPaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | "">("");

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<FiatUiQuote | null>(null);

  const [returnSessionId, setReturnSessionId] = useState<string | null>(null);
  const [returnStatus, setReturnStatus] = useState<{
    providerName: string;
    status: FiatSessionStatus;
    sourceAmount?: string;
    destinationAmount?: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy",
  );

  const walletOptions = useMemo(() => {
    const seen = new Set<string>();

    return wallets
      .filter((wallet) => {
        const key = wallet.address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((wallet) => ({
        address: wallet.address as `0x${string}`,
        label:
          wallet.walletClientType === "privy"
            ? "Krypto121 wallet"
            : "Linked wallet",
      }));
  }, [wallets]);

  const countryNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(
        typeof navigator === "undefined" ? ["en"] : [navigator.language],
        { type: "region" },
      );
    } catch {
      return null;
    }
  }, []);

  function clearReview() {
    setQuote(null);
    setError(null);
  }

  useEffect(() => {
    if (!embeddedWallet?.address) return;

    let cancelled = false;

    void (async () => {
      try {
        const [profileResult, nextBusinessProfile] = await Promise.all([
          syncProfile(
            getAccessToken,
            embeddedWallet.address as `0x${string}`,
          ),
          getBusinessProfile(getAccessToken),
        ]);

        if (!cancelled) {
          setProfile(profileResult.profile);
          setBusinessProfile(nextBusinessProfile);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load fiat account details",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embeddedWallet?.address, getAccessToken]);

  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    void (async () => {
      setLoadingOptions(true);
      try {
        const result = await getFiatOptions(getAccessToken, { direction });
        if (cancelled) return;

        setCountries(result.countries);
        setSuggestedSubdivision(result.suggestedSubdivision ?? "");

        const preferred =
          businessProfile?.countryCode?.toUpperCase() &&
          result.countries.includes(businessProfile.countryCode.toUpperCase())
            ? businessProfile.countryCode.toUpperCase()
            : result.suggestedCountry &&
                result.countries.includes(result.suggestedCountry.toUpperCase())
              ? result.suggestedCountry.toUpperCase()
              : result.countries[0] ?? "";

        setCountryCode(preferred);
        setSubdivisionCode(
          preferred === "US" ? result.suggestedSubdivision ?? "" : "",
        );
        setCurrencies([]);
        setFiatCurrency("");
        setAssets([]);
        setCryptoAssetKey("");
        setPaymentMethods([]);
        setPaymentMethodId("");
        clearReview();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load fiat countries",
          );
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, businessProfile?.countryCode, direction, getAccessToken]);

  useEffect(() => {
    if (!authenticated || !countryCode) return;
    if (countryCode === "US" && subdivisionCode.length !== 2) {
      setCurrencies([]);
      setFiatCurrency("");
      setAssets([]);
      setCryptoAssetKey("");
      setPaymentMethods([]);
      setPaymentMethodId("");
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingOptions(true);
      try {
        const result = await getFiatOptions(getAccessToken, {
          direction,
          countryCode,
          subdivisionCode: countryCode === "US" ? subdivisionCode || undefined : undefined,
        });

        if (cancelled) return;

        setCurrencies(result.currencies);
        const preferred =
          result.currencies.includes("EUR")
            ? "EUR"
            : result.currencies.includes("USD")
              ? "USD"
              : result.currencies[0] ?? "";

        setFiatCurrency(preferred);
        setAssets([]);
        setCryptoAssetKey("");
        setPaymentMethods([]);
        setPaymentMethodId("");
        clearReview();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load fiat currencies",
          );
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    countryCode,
    direction,
    getAccessToken,
    subdivisionCode,
  ]);

  useEffect(() => {
    if (
      !authenticated ||
      !countryCode ||
      !fiatCurrency ||
      (countryCode === "US" && subdivisionCode.length !== 2)
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingOptions(true);
      try {
        const result = await getFiatOptions(getAccessToken, {
          direction,
          countryCode,
          subdivisionCode: countryCode === "US" ? subdivisionCode : undefined,
          fiatCurrency,
        });

        if (cancelled) return;

        setAssets(result.assets);
        setPaymentMethods(result.paymentMethods);
        setCryptoAssetKey(result.assets[0]?.key ?? "");
        setPaymentMethodId(result.paymentMethods[0]?.id ?? "");
        clearReview();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load fiat routes",
          );
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    countryCode,
    direction,
    fiatCurrency,
    getAccessToken,
    subdivisionCode,
  ]);

  useEffect(() => {
    if (!walletAddress && walletOptions[0]) {
      setWalletAddress(walletOptions[0].address);
    }
  }, [walletAddress, walletOptions]);

  useEffect(() => {
    if (!authenticated) return;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    if (!sessionId) return;

    setReturnSessionId(sessionId);
    void refreshReturnStatus(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  async function refreshReturnStatus(sessionId = returnSessionId) {
    if (!sessionId) return;

    setStatusLoading(true);
    setError(null);

    try {
      const result = await readFiatSession(getAccessToken, sessionId);
      setReturnStatus(result.session);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not check fiat transaction",
      );
    } finally {
      setStatusLoading(false);
    }
  }

  async function review() {
    if (
      !countryCode ||
      !fiatCurrency ||
      !cryptoAssetKey ||
      !paymentMethodId ||
      !walletAddress ||
      !amount
    ) {
      setError("Complete the payment details");
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const result = await createFiatQuote(getAccessToken, {
        direction,
        countryCode,
        subdivisionCode:
          countryCode === "US" ? subdivisionCode || undefined : undefined,
        amount,
        fiatCurrency,
        cryptoAssetKey,
        walletAddress,
        paymentMethodId,
      });
      setQuote(result.quote);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not find a fiat route",
      );
    } finally {
      setWorking(false);
    }
  }

  async function continueToProvider() {
    if (!quote) return;

    setWorking(true);
    setError(null);

    try {
      const session = await createFiatSession(getAccessToken, quote.id);
      window.location.assign(session.url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start fiat checkout",
      );
      setWorking(false);
    }
  }

  function handleSidebar(section: SecondarySection) {
    if (section === "fiat") return;

    if (section === "wallets") {
      router.push("/wallets");
      return;
    }

    if (section === "beneficiaries") {
      router.push("/beneficiaries");
      return;
    }

    if (section === "developer") {
      router.push("/developer");
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
          <p className="eyebrow">Buy / Cash out</p>
          <h1>Move between fiat and stablecoins.</h1>
          <p className="landingLead">
            Sign in to find the best available fiat route.
          </p>
          <button className="primaryButton landingCta" onClick={login}>
            Create account/Log in
          </button>
        </section>
      </main>
    );
  }

  const selectedAsset = assets.find((asset) => asset.key === cryptoAssetKey);

  return (
    <div className="dashboardApp">
      <DashboardSidebar
        open={menuOpen}
        activeSection="fiat"
        email={user?.email?.address}
        onClose={() => setMenuOpen(false)}
        onSelect={handleSidebar}
        onLogout={logout}
        isSuperAdmin={profile?.role === "super_admin"}
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
              <p className="eyebrow">Fiat</p>
              <h1 className="dashboardTitle">Buy / Cash out</h1>
              <p className="walletPageLead">
                Choose the outcome. Krypto121 finds the best available provider route.
              </p>
            </div>
          </header>

          {returnSessionId ? (
            <section className="businessPanel">
              <div className="cardHeaderCompact">
                <div>
                  <p className="eyebrow">Recent fiat transaction</p>
                  <h2>
                    {statusLoading
                      ? "Checking status…"
                      : returnStatus
                        ? statusLabel(returnStatus.status)
                        : "Status unavailable"}
                  </h2>
                </div>
                <button
                  className="secondaryButton"
                  disabled={statusLoading}
                  onClick={() => void refreshReturnStatus()}
                >
                  Refresh status
                </button>
              </div>

              {returnStatus ? (
                <p className="muted">
                  {returnStatus.providerName}
                  {returnStatus.sourceAmount
                    ? ` · ${returnStatus.sourceAmount}`
                    : ""}
                  {returnStatus.destinationAmount
                    ? ` → ${returnStatus.destinationAmount}`
                    : ""}
                </p>
              ) : null}
            </section>
          ) : null}

          {profile && profile.accountStatus !== "active" ? (
            <div className="accountRestrictionNotice" role="status">
              <strong>Fiat actions are unavailable</strong>
              <span>
                {profile.statusReason ??
                  "This Krypto121 account is currently restricted."}
              </span>
            </div>
          ) : null}

          <section className="businessPanel">
            <div className="cardPrimaryActions">
              <button
                className={
                  direction === "fiat-to-crypto"
                    ? "primaryButton"
                    : "secondaryButton"
                }
                onClick={() => setDirection("fiat-to-crypto")}
              >
                Buy stablecoins
              </button>
              <button
                className={
                  direction === "crypto-to-fiat"
                    ? "primaryButton"
                    : "secondaryButton"
                }
                onClick={() => setDirection("crypto-to-fiat")}
              >
                Cash out
              </button>
            </div>

            {countries.length === 0 && !loadingOptions ? (
              <div className="accountRestrictionNotice">
                <strong>No fiat route is currently available.</strong>
                <span>
                  Check provider connections in Developer tools.
                </span>
              </div>
            ) : (
              <>
                <label className="field">
                  <span>Country of residence</span>
                  <select
                    value={countryCode}
                    onChange={(event) => {
                      setCountryCode(event.target.value);
                      clearReview();
                    }}
                  >
                    {countries.map((code) => (
                      <option key={code} value={code}>
                        {countryNames?.of(code) ?? code}
                      </option>
                    ))}
                  </select>
                </label>

                {countryCode === "US" ? (
                  <label className="field">
                    <span>State code</span>
                    <input
                      value={subdivisionCode}
                      onChange={(event) => {
                        setSubdivisionCode(
                          event.target.value.toUpperCase().slice(0, 2),
                        );
                        clearReview();
                      }}
                      placeholder={suggestedSubdivision || "NY"}
                      maxLength={2}
                    />
                  </label>
                ) : null}

                {direction === "fiat-to-crypto" ? (
                  <>
                    <label className="field">
                      <span>You pay</span>
                      <div className="amountField">
                        <input
                          value={amount}
                          onChange={(event) => {
                            setAmount(event.target.value);
                            clearReview();
                          }}
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                        <select
                          className={styles.amountCurrency}
                          value={fiatCurrency}
                          onChange={(event) => {
                            setFiatCurrency(event.target.value);
                            clearReview();
                          }}
                        >
                          {currencies.map((currency) => (
                            <option key={currency} value={currency}>
                              {currency}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Receive</span>
                      <select
                        value={cryptoAssetKey}
                        onChange={(event) => {
                          setCryptoAssetKey(event.target.value);
                          clearReview();
                        }}
                      >
                        {assets.map((asset) => (
                          <option key={asset.key} value={asset.key}>
                            {asset.symbol} · {asset.networkLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="field">
                      <span>Stablecoin</span>
                      <select
                        value={cryptoAssetKey}
                        onChange={(event) => {
                          setCryptoAssetKey(event.target.value);
                          clearReview();
                        }}
                      >
                        {assets.map((asset) => (
                          <option key={asset.key} value={asset.key}>
                            {asset.symbol} · {asset.networkLabel}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>You sell</span>
                      <div className="amountField">
                        <input
                          value={amount}
                          onChange={(event) => {
                            setAmount(event.target.value);
                            clearReview();
                          }}
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                        <strong>{selectedAsset?.symbol ?? "—"}</strong>
                      </div>
                    </label>

                    <label className="field">
                      <span>You receive</span>
                      <select
                        value={fiatCurrency}
                        onChange={(event) => {
                          setFiatCurrency(event.target.value);
                          clearReview();
                        }}
                      >
                        {currencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <label className="field">
                  <span>
                    {direction === "fiat-to-crypto"
                      ? "Receive in"
                      : "Pay from"}
                  </span>
                  <select
                    value={walletAddress}
                    onChange={(event) => {
                      setWalletAddress(event.target.value as `0x${string}`);
                      clearReview();
                    }}
                  >
                    {walletOptions.map((wallet) => (
                      <option key={wallet.address} value={wallet.address}>
                        {wallet.label} · {shortAddress(wallet.address)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>
                    {direction === "fiat-to-crypto"
                      ? "Payment method"
                      : "Payout method"}
                  </span>
                  <select
                    value={paymentMethodId}
                    onChange={(event) => {
                      setPaymentMethodId(event.target.value);
                      clearReview();
                    }}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedAsset ? (
                  <p className="hint">
                    {selectedAsset.symbol} will use {selectedAsset.networkLabel}.
                  </p>
                ) : null}

                {loadingOptions ? (
                  <p className="hint">Checking available routes…</p>
                ) : null}

                {error ? <p className="errorText">{error}</p> : null}

                {!quote ? (
                  <div className="actions">
                    <button
                      className="primaryButton"
                      disabled={
                        working ||
                        loadingOptions ||
                        profile?.accountStatus !== "active" ||
                        !amount ||
                        !fiatCurrency ||
                        !cryptoAssetKey ||
                        !walletAddress ||
                        !paymentMethodId
                      }
                      onClick={() => void review()}
                    >
                      {working ? "Finding route…" : "Review"}
                    </button>
                  </div>
                ) : (
                  <div className="paymentReadiness">
                    <div className="paymentReadinessHeader">
                      <div>
                        <p className="eyebrow">Review</p>
                        <h3>
                          {quote.destinationAmount} {quote.destinationSymbol}
                        </h3>
                      </div>
                      <span className="readinessOverall readinessOverall-ready">
                        Best route
                      </span>
                    </div>

                    <div className="reviewRows">
                      <div>
                        <span>You pay</span>
                        <strong>
                          {quote.sourceAmount} {quote.sourceSymbol}
                        </strong>
                      </div>
                      <div>
                        <span>You receive</span>
                        <strong>
                          {quote.destinationAmount} {quote.destinationSymbol}
                        </strong>
                      </div>
                    </div>

                    <details className="technicalDetails">
                      <summary>Cost and route details</summary>
                      <div className="technicalDetailsBody">
                        {quote.fees.length ? (
                          quote.fees.map((fee) => (
                            <div key={`${fee.label}-${fee.assetSymbol}`}>
                              <span>{fee.label}</span>
                              <strong>
                                {fee.amount} {fee.assetSymbol}
                              </strong>
                            </div>
                          ))
                        ) : (
                          <div>
                            <span>Provider fees</span>
                            <strong>Included in quote</strong>
                          </div>
                        )}
                        <div>
                          <span>Provider</span>
                          <strong>{quote.providerName}</strong>
                        </div>
                        <div>
                          <span>Network</span>
                          <strong>{quote.cryptoNetworkLabel}</strong>
                        </div>
                      </div>
                    </details>

                    {error ? <p className="errorText">{error}</p> : null}

                    <div className="actions">
                      <button
                        className="secondaryButton"
                        disabled={working}
                        onClick={clearReview}
                      >
                        Back
                      </button>
                      <button
                        className="primaryButton"
                        disabled={working}
                        onClick={() => void continueToProvider()}
                      >
                        {working ? "Opening checkout…" : "Continue"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
