# Krypto121 v0.26B — Coinbase Fiat Provider

This is the first real provider adapter behind the provider-neutral v0.26 fiat-routing foundation.

It does **not** add fiat controls to the user interface yet.

## Why Coinbase first

Coinbase currently exposes a complete public developer path for both:

```text
fiat → crypto
crypto → fiat
```

including:

- country/payment-method discovery
- fiat/crypto option discovery
- buy quotes
- sell quotes
- secure session tokens
- hosted onramp/offramp flows
- transaction status

Kraken remains a future provider behind the same `FiatProvider` contract.

## Added

```text
src/lib/fiat/providers/coinbase.ts
src/lib/server/fiatProviders.ts
```

## Refined generic contract

```text
src/lib/fiat/types.ts
src/lib/fiat/provider.ts
```

The refinements add:

- optional ISO subdivision/state
- optional trusted end-user client IP
- original quote request passed into `createSession()`

These are provider-neutral requirements needed by regulated fiat rails.

## Coinbase authentication

The adapter uses Coinbase's official JWT helper from:

```text
@coinbase/cdp-sdk
```

Pinned version:

```text
1.55.0
```

The new 1.56.0 release was intentionally not adopted immediately.

Server-only environment variables:

```text
COINBASE_CDP_API_KEY_ID=
COINBASE_CDP_API_KEY_SECRET=
```

Do **not** prefix either with `NEXT_PUBLIC_`.

No Coinbase Wallet Secret is required for this adapter because Krypto121 is not asking Coinbase to sign wallet transactions.

If these environment variables are absent, Coinbase is simply not registered as an available fiat provider.

## Provider registration

Use:

```ts
getConfiguredFiatProviders()
```

from:

```text
src/lib/server/fiatProviders.ts
```

Only configured providers are returned.

## Supported behavior

### Discovery

Coinbase live APIs determine:

- supported countries
- supported fiat currencies
- supported crypto assets and networks
- supported payment methods

Krypto121 does not hard-code Coinbase country coverage.

Config/options responses are cached in-process for five minutes.

### Network matching

Krypto121 matches Coinbase networks using chain IDs rather than assuming a network name.

Current Krypto121 chain IDs:

```text
Celo Sepolia  11142220
Celo          42220
Base          8453
```

If Coinbase exposes a matching asset/network in its live Options API, the adapter can use it. Otherwise the route is marked unsupported.

### Quotes

The adapter currently accepts exact-source requests because Coinbase's v1 hosted buy/sell quote endpoints are source-amount based.

Examples:

```text
100 EUR → how much USDC?
50 USDC → how much EUR?
```

Exact-destination provider quoting remains unsupported by this Coinbase adapter for now rather than being approximated.

Coinbase documents its hosted quotes as estimates. Coinbase does not expose a quote-expiry timestamp in these v1 quote responses, so Krypto121 applies a short 60-second local quote freshness window before route selection/review.

### Sessions

Krypto121 creates a Coinbase session token server-side and builds the Coinbase-hosted URL with:

- single-use session token
- Krypto121 partner reference
- provider quote ID
- wallet/network/asset restriction
- redirect URL where applicable

Coinbase session tokens expire after five minutes.

### Status

The returned `providerSessionId` contains only:

```text
buy:<partnerUserRef>
```

or:

```text
sell:<partnerUserRef>
```

Krypto121 can poll Coinbase transaction status through `getStatus()` and normalize the result into:

```text
awaiting-user
processing
completed
failed
cancelled
expired
```

## Security boundary

Krypto121 never stores or sends:

- user private keys
- seed phrases
- bank credentials
- Coinbase customer passwords

Coinbase handles its own hosted onboarding/KYC/payment-method workflow.

The Coinbase CDP API key remains server-only.

## Client IP

Coinbase requires the end-user client IP when creating a session token and warns integrations not to trust spoofable forwarding headers blindly.

This adapter therefore expects `clientIp` to be explicitly supplied by a trusted server layer. It does not guess one itself.

## Not included yet

- fiat UI
- Coinbase credentials
- Kraken adapter
- provider database persistence
- webhooks
- onchain offramp execution
- automatic Celo → Base → Coinbase route composition

These remain separate steps so no fake or incomplete user-facing fiat path is exposed.

## Database

No migration is required.

## Build

Apply this overlay on top of current v0.26 and run:

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```
