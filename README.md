# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.13 — Dedicated My wallets page

`My wallets` now has its own full page:

```text
/wallets
```

Each wallet is shown as a compact one-line accordion. The top row shows only the essentials:

```text
Wallet | address | balance | status
```

Expand a wallet to see its full details and actions.

Owned, connected wallets include **Make payment from this wallet**, which opens the existing Send flow with that wallet preselected.

Watch-only wallets remain view-only and cannot make payments.

### Retained wallet actions

- Link existing wallet
- Add watch-only wallet
- Connect linked wallet
- Refresh balances
- Copy address
- Remove watch-only wallet

### Upgrade

No Supabase migration and no new environment variables are required.

```bash
npm install
npm run build
```

See `docs/upgrades/UPGRADE-v0.13.md`.
