# v0.27 — Fiat UI and provider connection checks

## Product behavior

Fiat functionality is no longer hidden.

Users can open:

```text
/fiat
```

from the normal sidebar through **Buy / Cash out**.

The flow is intentionally compact:

```text
Choose direction
→ choose amount/outcome
→ Krypto121 discovers available provider options
→ review best route
→ continue to regulated provider checkout
```

## Provider-neutral connection status

Developer tools now checks all registered fiat providers through one control:

```text
Check connections
```

Each provider reports:

- configured/not configured
- connected/error
- whether buy is available
- whether cash out is available
- number of supported countries

No provider credentials, JWTs or raw provider responses are exposed to the browser.

## Quote routing

The UI calls Krypto121, not Coinbase directly.

Krypto121:

1. validates the authenticated account
2. reads provider capabilities
3. obtains quotes from every configured provider
4. filters invalid/expired routes
5. selects the best normalized quote
6. stores the selected quote server-side
7. shows only the payment outcome and essential totals to the user

Provider and fee details remain available under an expandable review section.

## Fiat session persistence

Migration 012 adds durable server-only records for:

```text
fiat_quotes
fiat_sessions
```

This prevents the browser from supplying a modified provider quote back to session creation and gives Krypto121 a durable session reference for return/status checking.

The single-use Coinbase session token/URL is not stored.

## Coinbase hosted checkout

For the current Coinbase adapter:

- quote is requested server-side
- session token is created server-side
- browser is redirected to Coinbase-hosted checkout
- Coinbase redirects to `/fiat?session=<Krypto121 session id>`
- Krypto121 checks provider transaction status after return

## Security boundary

Krypto121 does not collect or store:

- Coinbase credentials in the browser
- bank credentials
- card details
- KYC documents
- provider session tokens in Supabase
- end-user IP in the fiat quote/session tables

Provider checkout/KYC/payment method handling remains with the regulated provider.

## Coinbase domain allowlist

Add this production origin in CDP:

```text
https://www.krypto121.app
```

under Payments → Onramp & Offramp → Domain Allowlist.

## Database

Apply:

```text
supabase/migrations/202609160012_fiat_routing.sql
```

## Dependency

Added:

```text
@vercel/functions 3.9.7
```

for Vercel geolocation/IP request helpers.

## Build

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```
