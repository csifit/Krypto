# Upgrade v0.10 — Blockchain abstraction UX

v0.10 keeps the blockchain implementation unchanged while simplifying what normal users see.

## Product rule

```text
Normal user
  -> wallets
  -> balances
  -> payments
  -> simple network fee status

Technical / developer view
  -> Celo Sepolia
  -> CELO gas balance
  -> transaction hash
  -> Blockscout
```

## Changes

- removed the explorer link from the main My wallet card;
- replaced raw CELO balance in My wallets with a plain-language network-fee status for owned wallets;
- removed Celo/Blockscout wording from the normal Receive flow;
- changed the direct route display to `Direct stablecoin transfer`;
- changed the fee display to `Paid by the source wallet`;
- moved transaction hash, network name and blockchain explorer link into collapsible Technical details;
- kept network/explorer information available in Developer / test tools.

## Important

This is **not gas sponsorship**. The underlying Celo transaction still requires the source wallet to have enough native network token to pay its transaction fee.

No database migration is required.
No environment variable changes are required.
