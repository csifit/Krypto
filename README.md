# Krypto121 v0.25 — Business payment/API improvements

This revised v0.25 replaces the earlier v0.25 package.

## Developer tools

Developer tools now has its own page:

```text
/developer
```

The existing sidebar item opens this page directly.

The page contains:

- Business API key management
- Business payment API endpoint information
- network information
- supported assets
- wallet provider information
- technical wallet explorer link
- test-fund controls when running on testnet

API configuration is no longer shown inside Business profile.

Business profile stays focused on:

- business / trading name
- country
- business email
- default receive wallet
- default receive asset
- compact business activity overview

## Business API key

Each Krypto121 Business account can maintain one active Business API key.

The full secret is shown only once when generated or rotated.

Krypto121 stores only:

- display prefix
- SHA-256 hash
- created time
- last-used time
- revocation time

## Versioned Business payment API

```text
/api/v1/payment-requests
```

Authentication:

```http
Authorization: Bearer <KRYPT0121_API_KEY>
```

Supported operations:

- `POST` — create a tracked fixed-amount payment request
- `GET` — list requests
- `GET ?id=<request-id>` — read one request
- `GET ?externalReference=<value>` — read by external reference
- `PATCH` — cancel a pending request

## External reference

`externalReference` is optional and unique per Krypto121 account.

Repeating the same create request with the same reference and identical payment facts returns the existing request instead of creating a duplicate.

Reusing the reference with different payment facts returns HTTP 409.

## Migration

Migration 011 is unchanged:

```text
supabase/migrations/202609150011_business_api.sql
```

## No new environment variables

## Apply

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```
