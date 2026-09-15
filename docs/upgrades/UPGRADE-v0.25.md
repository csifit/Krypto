# v0.25 — Business payment/API improvements

## Revised navigation

Developer-facing configuration now lives on a dedicated:

```text
/developer
```

page.

The existing **Developer tools** sidebar link opens it directly.

### Developer tools includes

- Business API key generate / rotate / revoke
- API endpoint summary
- Network
- Supported assets
- Wallet provider
- Technical explorer
- Test funds on testnet

### Business profile no longer includes API controls

Business profile remains business-facing configuration only.

## Business API

Endpoint:

```text
/api/v1/payment-requests
```

Authentication:

```http
Authorization: Bearer <API_KEY>
```

Operations:

```text
POST
GET
GET ?id=<uuid>
GET ?externalReference=<reference>
PATCH action=cancel
```

API-created requests use the existing Krypto121 tracked payment request and reconciliation system.

## External references

An optional `externalReference` ties a Krypto121 payment request to an external order, invoice, booking, or other business record.

The value is unique per Krypto121 account.

Identical repeats reuse the existing request. Conflicting repeats return HTTP 409.

## Migration

No change from the first v0.25 package:

```text
202609150011_business_api.sql
```

## Apply

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```
