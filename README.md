# Krypto121 v0.20 — Gas abstraction

This is an **overlay package** for the current v0.19 project. Copy its files over the existing project.

## What changes

On Celo Mainnet, the Krypto121 embedded wallet can pay the network fee in USDT instead of requiring CELO.

The normal payment flow remains:

```text
Choose where to pay
→ choose how much
→ review recipient amount + fee + estimated total
→ make payment
```

No extra gas-token step is added.

## Important compatibility boundary

Celo fee abstraction uses the Celo-specific CIP-64 transaction format. Krypto121 uses it for the Privy embedded wallet.

Linked external wallets keep their own fee behavior. Generic Ethereum wallets such as MetaMask may still require CELO because they use the Ethereum-compatible transaction format.

## Apply

No database migration.

No new environment variables.

Keep production:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=mainnet
```

Then run:

```bash
npm install
npm run build
```

See `docs/upgrades/UPGRADE-v0.20.md`.
