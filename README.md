# Krypto

Krypto is a business-first stablecoin payments application.

## Current direction

- USDT first
- Celo first
- Non-custodial embedded wallet
- Business-oriented UX
- Payment-intent and routing architecture
- Privy in V1 behind a replaceable wallet-provider boundary
- Custom Krypto MPC infrastructure remains the long-term wallet direction

## v0.5

v0.5 keeps the tested payment flow intact and simplifies the interface.

The dashboard intentionally shows only three primary cards:

1. My wallet
2. Balance
3. Send / Receive

Secondary functions live in the sidebar / side-card:

- Beneficiaries
- Payment history
- Developer tools
- Account / theme controls

On mobile, the sidebar is hidden behind a hamburger menu.

The landing page states the Krypto advantage directly:

- user controls funds
- Krypto finds the payment route
- costs are reviewed before approval

## Development

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Test network

Celo Sepolia only. Test USDTd and test CELO have no real-world value.

See `docs/ARCHITECTURE.md` for the product architecture.
