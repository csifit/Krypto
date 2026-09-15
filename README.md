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
