# Upgrade v0.12 — Payment readiness / fee preflight

v0.12 adds a preflight gate before Krypto121 creates a payment quote.

## Checks

```text
Selected source wallet
  |
  +-- Recipient valid?
  +-- Stablecoin balance sufficient?
  +-- Network fee balance sufficient?
  +-- Direct route available?
  |
  v
Ready to review
```

The user-facing UI deliberately avoids exposing the native network token. It shows Recipient, Funds, Network fees and Route readiness.

For the current direct test route, Krypto121 estimates the ERC-20 transfer gas, reads the current gas price, applies a 25% safety margin, and compares the result with the source wallet's native network balance.

This is a preflight estimate, not a guaranteed final fee. No transaction is sent and no approval is requested by the preflight.

No database migration is required. No environment variable changes are required.
