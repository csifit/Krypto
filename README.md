# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.12 — Payment readiness / fee preflight

Before Send can advance to review, Krypto121 checks recipient validity, source-wallet USDTd balance, network-fee readiness and direct-route availability.

The normal UI does not expose CELO. It reports only payment readiness states.

No Supabase migration and no new environment variables are required.

```bash
npm install
npm run build
```

See `docs/upgrades/UPGRADE-v0.12.md`.
