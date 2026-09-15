# Krypto121 v0.25 — Business payment/API improvements

## Goal

v0.25 makes the existing tracked payment-request model usable from an external business system without creating a second payment system.

The API creates the same `business_payment_requests` records used by the Krypto121 dashboard and uses the same settlement reconciliation.

## API key management

Business profile now includes a compact Business API section.

The user can:

- Generate API key
- Rotate API key
- Revoke API key
- See key prefix
- See creation time
- See last-used time

Only one active key is allowed per account.

The secret is returned once. Only its SHA-256 hash is stored.

A suspended or blocked account cannot use the API or generate/rotate a key. An authenticated user can still revoke their key.

## Endpoint

```text
/api/v1/payment-requests
```

### Create

```http
POST /api/v1/payment-requests
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

Example:

```json
{
  "amount": "125.50",
  "memo": "Invoice 1042",
  "externalReference": "order-1042"
}
```

Optional explicit fields:

```json
{
  "recipient": "0x...",
  "asset": "USDC"
}
```

When omitted, the Business profile's default receive wallet and asset are used.

The receive wallet must still belong to the Krypto121 account.

### Read/list

```text
GET /api/v1/payment-requests
GET /api/v1/payment-requests?id=<uuid>
GET /api/v1/payment-requests?externalReference=<reference>
```

### Cancel

```http
PATCH /api/v1/payment-requests
```

```json
{
  "id": "<uuid>",
  "action": "cancel"
}
```

Only Pending requests can be cancelled.

## API response

Payment request responses include the existing request fields plus:

```text
paymentUrl
externalReference
```

`paymentUrl` opens the normal Krypto121 payer flow.

## External reference / duplicate protection

Migration 011 adds `external_reference` to `business_payment_requests`.

It is unique per Krypto121 account when present.

If the external system repeats the same request with the same external reference and identical:

- recipient;
- asset;
- amount;
- memo;

Krypto121 returns the existing request with:

```json
{
  "reused": true
}
```

If the reference is already used for different payment facts, Krypto121 returns HTTP 409.

## Deliberately not included

- Webhooks
- Team-scoped API keys
- Multiple simultaneous API keys
- Invoicing API
- Accounting integration
- Fiat/FX API
- Automatic refunds

These can be layered on the same versioned API later without changing the payment model.

## Migration

```text
202609150011_business_api.sql
```

It creates:

- `business_api_keys`
- active-key uniqueness
- API-key RLS
- `business_payment_requests.external_reference`
- external-reference uniqueness

## Apply

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```
