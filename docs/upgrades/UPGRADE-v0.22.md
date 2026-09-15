# Krypto121 v0.22 — First real Relay route

## Route

The first Relay route is deliberately narrow and real:

```text
Source:       USDC on Celo Mainnet
Destination:  USDC on Base Mainnet
Provider:     Relay
```

Krypto121 does not show a provider chooser.

Routing policy:

```text
Destination Celo + same asset
→ direct Celo transfer

Destination Base + USDC
→ Relay
```

## Payment semantics

Base payments use Relay `EXACT_OUTPUT`.

If the user enters:

```text
Recipient amount: 10 USDC
```

the Relay quote determines the source amount needed so the recipient receives the requested amount on Base.

The review screen shows:

- recipient gets;
- source amount ("You pay");
- route cost;
- Krypto121 fee (still 0).

## Execution

Relay quote requests are server-side.

`usePermit=false` is used for this first route so execution uses normal wallet transaction steps rather than adding a separate permit-signature implementation.

The Krypto121 embedded wallet submits Celo Relay transactions with USDC as the Celo fee currency.

Linked external wallets keep their normal wallet gas behavior.

## Settlement verification

Migration 008 adds `relay_quotes`.

Krypto121 stores the server-issued Relay quote identity and amount/route facts before the user signs.

When settlement is saved, the server verifies:

- the Relay request belongs to the authenticated Krypto121 user;
- saved source wallet and recipient;
- saved source and destination amounts;
- Celo USDC origin;
- Base USDC destination;
- Relay reports `success`;
- origin transaction hash matches Relay's incoming transaction;
- origin Celo transaction succeeded;
- Relay reports a destination transaction.

## API key

Relay currently allows low-volume quote/status use without an API key.

`RELAY_API_KEY` is optional and server-only. Configure it later if/when a higher production rate limit is needed.

## Apply

1. Copy the v0.22 overlay.
2. Apply migration 008.
3. Build.
4. Deploy.
5. Test direct Celo USDC still works.
6. Test the Base destination quote flow.

Do not fund a wallet just to test if you do not want to transact real value. A live Relay quote can be tested without approving the transaction.
