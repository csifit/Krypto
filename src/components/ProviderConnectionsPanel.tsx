"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  checkFiatProviderConnections,
  type FiatProviderConnection,
} from "@/lib/fiat/client";

function statusText(provider: FiatProviderConnection) {
  if (provider.status === "connected") return "Connected";
  if (provider.status === "not-configured") return "Not configured";
  return "Connection failed";
}

export default function ProviderConnectionsPanel() {
  const { getAccessToken } = usePrivy();
  const [providers, setProviders] = useState<FiatProviderConnection[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      const result = await checkFiatProviderConnections(getAccessToken);
      setProviders(result.providers);
      setCheckedAt(result.checkedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check providers");
    } finally {
      setChecking(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <section className="businessPanel">
      <div className="cardHeaderCompact">
        <div>
          <p className="eyebrow">Fiat providers</p>
          <h2>Provider connections</h2>
        </div>
        <button
          className="secondaryButton"
          disabled={checking}
          onClick={() => void check()}
        >
          {checking ? "Checking…" : "Check connections"}
        </button>
      </div>

      <p className="muted">
        Krypto121 checks every configured fiat provider from the server.
      </p>

      {error ? <p className="errorText">{error}</p> : null}

      <div className="developerFacts">
        {providers.map((provider) => (
          <div key={provider.id}>
            <span>{provider.name}</span>
            <strong>{statusText(provider)}</strong>
            {provider.status === "connected" ? (
              <small>
                Buy {provider.onramp ? "available" : "unavailable"} · Cash out{" "}
                {provider.offramp ? "available" : "unavailable"} ·{" "}
                {provider.countries} countries
              </small>
            ) : provider.errorCode ? (
              <small>{provider.errorCode}</small>
            ) : null}
          </div>
        ))}
      </div>

      {checkedAt ? (
        <p className="hint">
          Last checked {new Date(checkedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
