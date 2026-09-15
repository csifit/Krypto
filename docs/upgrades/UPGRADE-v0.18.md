# Upgrade v0.18 — Privileged Admin Security

v0.18 protects Krypto121's emergency administration controls with a short-lived privileged session.

## What changes

Normal user accounts are unchanged.

A `super_admin` must:

1. have at least one Privy MFA method enrolled;
2. verify a short-lived Krypto121 admin challenge with the account's embedded wallet;
3. re-verify after 15 minutes.

Because the embedded wallet is protected by Privy MFA, signing the admin challenge invokes Privy's MFA verification when required.

The admin challenge explicitly states that it does not authorize a payment or transfer funds.

## Server enforcement

The `/api/admin/*` operational endpoints no longer accept a normal authenticated Super Admin session by itself.

They require an HttpOnly, SameSite=Strict elevated-session cookie backed by a hashed server-side session record.

Sensitive controls protected by elevation include:

- global payment switch;
- mainnet gate;
- maximum payment amount;
- suspend / block / reactivate;
- user and audit visibility.

## Migration 007

Apply:

```text
supabase/migrations/202609150007_privileged_admin_access.sql
```

It creates:

```text
admin_elevation_challenges
admin_elevated_sessions
```

Browser access is denied with RLS and grants; Krypto121 server access remains service-role only.

## Privy setup

In the Privy Dashboard, enable at least one MFA method for the app before testing the Super Admin flow.

TOTP or passkey is recommended for the Super Admin account.

## UI polish

Expanded wallet and admin-user accordions use a slightly lighter gray background so the open row is easier to scan.

No new environment variables are required.
