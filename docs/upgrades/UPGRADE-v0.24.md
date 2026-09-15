# v0.24 — Krypto121 Business + Beneficiary management

This is the revised v0.24 package. Migration 010 from the earlier package must not be applied.

## Beneficiary model

```text
Partner
├─ Name
├─ Business / Private
└─ Wallets
   ├─ Wallet A
   ├─ Wallet B
   └─ Wallet C
```

Partner order is alphabetical.

Wallet addresses are editable and removable.

## Dedicated Beneficiaries page

`/beneficiaries`

Each partner is an accordion row.

Expanded details allow:

- edit partner name;
- edit Business / Private classification;
- edit wallet addresses;
- remove mistyped wallets;
- add more wallets;
- choose which wallet to pay;
- Make payment to this partner;
- open Payment history modal.

## Payment history

Payments support a nullable `beneficiary_partner_id`.

When a saved partner is used, that ID is stored on the payment.

Migration 010 backfills existing payments when a legacy beneficiary wallet matches the historical destination.

The modal includes payments associated by partner ID and by the partner's current wallets.

## Save recipient after payment

Unknown recipient addresses can be saved after settlement without interrupting payment approval.

A wallet can be saved as a new partner or added to an existing partner.

## Business identity

The Krypto121 user's own Business profile remains separate from Beneficiaries.

## Migration

`202609150010_business_profiles.sql`

It includes:

- business_profiles
- beneficiary_partners
- beneficiary_wallets
- migration of legacy beneficiary data
- payment partner association/backfill
- tracked-request business-name snapshot

## Apply

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```
