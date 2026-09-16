# v0.26B — First real fiat provider adapter

## Provider

Coinbase CDP Onramp/Offramp is the first implementation of `FiatProvider`.

This does not make Coinbase the Krypto121 architecture. It is provider #1 behind the existing abstraction.

Future provider structure remains:

```text
FiatProvider
├─ CoinbaseFiatProvider
├─ KrakenFiatProvider
└─ future providers
```

## Why Coinbase is implemented before Kraken

Coinbase currently exposes public production documentation for both hosted onramp and offramp, including discovery, quotes, session tokens and transaction status.

Kraken's commercial Ramp product advertises buy and sell, but its currently public Ramp API material is still more complete for onramp. Kraken should be added once its sell/offramp production API contract is available to Krypto121.

## Dependencies

Adds:

```text
@coinbase/cdp-sdk 1.55.0
```

This is used only for Coinbase request-bound JWT authentication.

## Environment

Server-only:

```text
COINBASE_CDP_API_KEY_ID
COINBASE_CDP_API_KEY_SECRET
```

Without both values, Coinbase is not registered.

## No UI yet

Do not expose Fiat / Cash out in Send until all of the following are ready:

1. provider session persistence
2. trusted client-IP resolution
3. redirect/recovery flow
4. offramp onchain send execution
5. settlement/reconciliation
6. end-to-end sandbox or trial-mode validation

## No migration

v0.26B has no Supabase migration.
