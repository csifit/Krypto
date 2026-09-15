# Upgrade v0.17 — Operational safety controls

v0.17 adds production-reusable emergency controls without imposing default limits on users.

## Defaults

```text
Accounts                  Active
Per-user payment limit    None
Global payments           Enabled
Maximum payment amount    No limit
Mainnet payment gate      Disabled
```

Suspension/blocking is manual and exceptional. There is no automated account restriction logic.

## Migration 006

Apply:

```text
supabase/migrations/202609150006_operational_safety_controls.sql
```

It adds to `profiles`:

```text
email
role
account_status
status_reason
status_changed_at
status_changed_by
```

It also adds:

```text
operational_settings
admin_audit_log
```

## Bootstrap the first super admin

There is deliberately no hard-coded default administrator.

After migration 006 is applied and the intended administrator has loaded the normal Krypto121 dashboard once, inspect the profile rows in Supabase:

```sql
select privy_user_id, email, wallet_address, role, account_status
from public.profiles
order by created_at;
```

Then promote exactly the intended account, for example by its verified login email:

```sql
update public.profiles
set role = 'super_admin'
where lower(email) = lower('YOUR_LOGIN_EMAIL');
```

Refresh Krypto121. The sidebar will show **Administration** and `/admin` will become available.

Do not make role assignment available through public registration or normal account settings.

## Payment execution policy

Immediately before requesting the wallet signature, Krypto121 now asks the server to authorize the payment. The server verifies account status, wallet ownership, global payment state, mainnet gate when relevant, and the optional maximum amount.

This is invisible to the normal user and adds no payment step.

## RPC failover foundation

The server-side settlement verifier now uses a configurable Celo Sepolia RPC transport.

Optional server-only environment variables:

```text
CELO_SEPOLIA_RPC_PRIMARY=https://forno.celo-sepolia.celo-testnet.org
CELO_SEPOLIA_RPC_SECONDARY=
```

The primary defaults to Celo Forno when omitted. A secondary endpoint is optional today. Configure a professional independent endpoint before production so critical server verification can fail over.

## Mainnet

Mainnet remains disabled. Keep:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

The new **Mainnet payment gate** defaults to OFF and does not enable mainnet code by itself.
