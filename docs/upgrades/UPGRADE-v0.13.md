# Upgrade v0.13 — Dedicated My wallets page

`My wallets` is now a full page at:

```text
/wallets
```

The dashboard sidebar opens this page instead of showing wallets in the small side panel.

## Wallet rows

Each wallet appears as one compact accordion row showing:

```text
Name / type | short address | USDTd balance | status
```

Opening the row shows the full details:

- full wallet address;
- wallet type;
- ownership state;
- connection state;
- stablecoin balance;
- network-fee readiness;
- provider;
- test environment / technical network information.

## Payment action

Owned signing wallets include:

```text
Make payment from this wallet
```

The action returns to the main payment flow with that wallet preselected as the payment source.

A linked wallet that is not connected must be connected first.
Watch-only wallets keep the payment button disabled because they cannot sign transactions.

## Existing actions retained

- Link existing wallet
- Add watch-only
- Refresh balances
- Copy address
- Remove watch-only wallet

No database migration is required.
No environment variable changes are required.
