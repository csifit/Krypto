# Krypto121 v0.23 — Persistent business payment requests

v0.23 turns fixed-amount QR/payment links into tracked business payment requests.

## Flow

```text
Business creates request
→ Krypto121 stores Pending request
→ business shares link / QR
→ payer opens link
→ normal Krypto121 review + approval
→ settlement is verified
→ request becomes Paid
```

The payer gets no extra payment step.

## Fixed amount vs reusable QR

A fixed amount creates a tracked request.

An amount-less request remains reusable and untracked.

This is deliberate: a reusable QR should not become "Paid" after its first use.

## Request states

- Pending
- Paid
- Cancelled

A cancelled or already-paid tracked link no longer opens the payment flow.

## Reconciliation

A tracked request is marked Paid only if the verified direct Celo settlement matches:

- request ID;
- exact recipient wallet;
- exact stablecoin;
- exact network;
- exact fixed amount.

The request ID alone cannot mark a request as paid.

## Privacy

No customer name, email, phone number or other payer PII is stored by this feature.

## Migration

Apply:

`202609150009_business_payment_requests.sql`

## New dashboard area

Sidebar:

`Payment requests`

Businesses can see the latest tracked requests, copy a pending link and cancel a pending request.

## Apply

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```

No new environment variables.
