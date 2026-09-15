"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { BusinessApiKeyStatus } from "@/lib/business/apiKey";

async function businessApiRequest<T>(
  getAccessToken: () => Promise<string | null>,
  init?: RequestInit,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Your session expired. Please log in again.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch("/api/business-api-key", {
    ...init,
    headers,
  });

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(
      body.error || "Krypto121 Business API request failed",
    );
  }

  return body;
}

export default function BusinessApiPanel({
  businessProfileReady,
  readOnly = false,
}: {
  businessProfileReady: boolean;
  readOnly?: boolean;
}) {
  const { getAccessToken } = usePrivy();
  const [status, setStatus] = useState<BusinessApiKeyStatus>({
    active: false,
  });
  const [secret, setSecret] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const result = await businessApiRequest<{
        status: BusinessApiKeyStatus;
      }>(getAccessToken);
      setStatus(result.status);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load Business API key status",
      );
    }
  }

  useEffect(() => {
    void loadStatus();
    // getAccessToken is stable in Privy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rotate() {
    setWorking(true);
    setError(null);
    setSecret(null);

    try {
      const result = await businessApiRequest<{
        apiKey: string;
        status: BusinessApiKeyStatus;
      }>(getAccessToken, { method: "POST" });

      setStatus(result.status);
      setSecret(result.apiKey);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate Business API key",
      );
    } finally {
      setWorking(false);
    }
  }

  async function revoke() {
    setWorking(true);
    setError(null);
    setSecret(null);

    try {
      await businessApiRequest<{ ok: true }>(
        getAccessToken,
        { method: "DELETE" },
      );
      setStatus({ active: false });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not revoke Business API key",
      );
    } finally {
      setWorking(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="paymentRequestBuilder">
      <div className="paymentRequestHeading">
        <div>
          <p className="eyebrow">Business API</p>
          <h3>Payment request API</h3>
        </div>
      </div>

      <p className="muted">
        Create and track payment requests from your own system.
      </p>

      <div className="reviewRows">
        <div>
          <span>Endpoint</span>
          <strong>/api/v1/payment-requests</strong>
        </div>

        <div>
          <span>API key</span>
          <strong>
            {status.active
              ? status.prefix ?? "Active"
              : "Not configured"}
          </strong>
        </div>

        {status.createdAt ? (
          <div>
            <span>Created</span>
            <strong>
              {new Date(status.createdAt).toLocaleString()}
            </strong>
          </div>
        ) : null}

        {status.lastUsedAt ? (
          <div>
            <span>Last used</span>
            <strong>
              {new Date(status.lastUsedAt).toLocaleString()}
            </strong>
          </div>
        ) : null}
      </div>

      {!businessProfileReady ? (
        <p className="hint">
          Save your Business profile before generating an API key.
        </p>
      ) : null}

      {secret ? (
        <div className="saveRecipientCard">
          <p className="eyebrow">New API key</p>
          <p className="addressBox breakWord">{secret}</p>
          <p className="hint">
            Copy this key now. Krypto121 stores only its hash and
            cannot show the secret again.
          </p>
          <div className="actions">
            <button
              className="secondaryButton"
              onClick={() => void copySecret()}
            >
              {copied ? "Copied" : "Copy API key"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="errorText">{error}</p> : null}

      <div className="actions">
        <button
          className="secondaryButton"
          disabled={
            readOnly ||
            working ||
            !businessProfileReady
          }
          onClick={() => void rotate()}
        >
          {working
            ? "Working…"
            : status.active
              ? "Rotate API key"
              : "Generate API key"}
        </button>

        {status.active ? (
          <button
            className="textButton"
            disabled={readOnly || working}
            onClick={() => void revoke()}
          >
            Revoke
          </button>
        ) : null}
      </div>

      <details className="technicalDetails">
        <summary>API usage</summary>
        <div className="technicalDetailsBody">
          <div>
            <span>Authentication</span>
            <strong>Authorization: Bearer &lt;API_KEY&gt;</strong>
          </div>
          <div>
            <span>Create</span>
            <strong>POST /api/v1/payment-requests</strong>
          </div>
          <div>
            <span>Read / list</span>
            <strong>GET /api/v1/payment-requests</strong>
          </div>
          <div>
            <span>Cancel</span>
            <strong>PATCH /api/v1/payment-requests</strong>
          </div>
        </div>
      </details>
    </div>
  );
}
