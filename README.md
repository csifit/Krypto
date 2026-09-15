# Krypto121 v0.24 — Business + Beneficiaries

This revised v0.24 replaces the earlier v0.24 package.

**Do not apply the earlier migration 010. Use the migration included here.**

## Own business identity

Krypto121 Business profile:

- Business / trading name
- Country
- Business email
- Default receive wallet
- Default receive stablecoin

New tracked incoming payment requests snapshot the business name for payer-facing identity.

## Beneficiaries

Dedicated page:

`/beneficiaries`

Each partner is one accordion row, sorted alphabetically.

A partner has:

- Name
- Type: Business / Private
- Multiple wallets

Wallet addresses are editable and removable. They are intentionally not immutable.

Expanded partner controls include:

- edit name/type;
- edit a wallet address;
- remove a wallet;
- add another wallet;
- choose the payment wallet;
- **Make payment to this partner**;
- **Payment history** modal.

## First payment to a new wallet

After a successful payment to an unknown address, Krypto121 shows:

`Save recipient`

The wallet can be saved as:

- a new Business partner;
- a new Private partner;
- another wallet on an existing partner.

The settled payment is then associated with that partner.

## History association

Payments now have an optional `beneficiary_partner_id`.

That lets partner history remain associated with the partner even if a wallet is edited later.

Migration 010 also backfills existing payments when their destination matches an existing legacy beneficiary wallet.

## Migration

Apply only:

`supabase/migrations/202609150010_business_profiles.sql`

No migration 011 is required.

## Build

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push

Remove-Item -Recurse -Force .next
npm install
npm run build
```
