# Krypto121 v0.25 — Business payment/API improvements

Overlay for v0.24.

## Business API key

Each Krypto121 Business account can maintain one active Business API key.

Key format:

```text
k121_live_...
```

or in testnet mode:

```text
k121_test_...
```

The full secret is shown only once when generated or rotated.

Krypto121 stores only:

- a display prefix;
- SHA-256 hash;
- created time;
- last-used time;
- revocation time.

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

## Create example

```json
{
  "amount": "125.50",
  "memo": "Invoice 1042",
  "externalReference": "order-1042"
}
```

If `recipient` and `asset` are omitted, Krypto121 uses the Business profile's default receive wallet and default receive asset.

The response includes a ready-to-share `paymentUrl`.

## External reference

`externalReference` is optional and unique per Krypto121 account.

Repeating the same create request with the same reference and identical payment facts returns the existing request instead of creating a duplicate.

Reusing the reference with different payment facts returns HTTP 409.

## No new environment variables

The Business API key is generated and stored by Krypto121.

## Migration

Apply:

```text
supabase/migrations/202609150011_business_api.sql
```

## Build

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```
