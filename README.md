# Krypto121 v0.23 — Business payment requests

Overlay for v0.22.

## New capability

Fixed-amount Receive links are now persistent and tracked:

```text
Pending → Paid
        ↘ Cancelled
```

Settlement reconciliation is server-side and only marks the request Paid when the verified payment matches the stored request facts.

Amount-less reusable QR codes remain untracked.

## Migration

`supabase/migrations/202609150009_business_payment_requests.sql`

## No new environment variables

Your Relay and mainnet configuration stays unchanged.

## Build

```powershell
Remove-Item -Recurse -Force .next
npm install
npm run build
```
