# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.17 — Operational safety controls

This milestone adds emergency controls that are reusable for production while keeping ordinary users unrestricted by default.

### Included

- server-side pre-authorization immediately before wallet signing;
- global Krypto121 payment kill-switch;
- explicit mainnet payment gate, OFF by default;
- optional maximum transaction amount, with **no limit by default**;
- `super_admin` role stored server-side;
- manual Active / Suspended / Blocked account states;
- immutable-by-application admin audit history;
- `/admin` operational dashboard;
- server-side Celo RPC health and optional failover foundation.

Suspension or blocking cannot freeze an external wallet or move user funds. It only disables Krypto121 write/payment actions while preserving read-only visibility.

## Upgrade

Apply:

```text
supabase/migrations/202609150006_operational_safety_controls.sql
```

Then:

```bash
npm install
npm run build
```

Keep:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

Optional server-only RPC settings:

```text
CELO_SEPOLIA_RPC_PRIMARY=https://forno.celo-sepolia.celo-testnet.org
CELO_SEPOLIA_RPC_SECONDARY=
```

There is no default super-admin account. See `docs/upgrades/UPGRADE-v0.17.md` for the one-time bootstrap procedure.


## v0.18 — Privileged Admin Security

Super Admin is an emergency control plane, so v0.18 adds a separate privileged-access step without changing ordinary user accounts.

Admin controls now require:

```text
Privy login
   ↓
MFA enrolled
   ↓
wallet-signed Krypto121 admin challenge
   ↓
15-minute privileged session
   ↓
administrative controls
```

The elevated session is stored as an HttpOnly SameSite=Strict cookie. Only a SHA-256 hash of the session token is stored in Supabase.

Migration:

```text
supabase/migrations/202609150007_privileged_admin_access.sql
```

Before testing, enable an MFA method in the Privy Dashboard.

Expanded wallet and admin-user accordions also receive a subtle lighter-gray open state.

See `docs/upgrades/UPGRADE-v0.18.md`.
