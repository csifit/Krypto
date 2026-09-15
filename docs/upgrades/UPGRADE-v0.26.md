# v0.26A — Fiat Routing Foundation

## Purpose

Create the stable production contract that future fiat providers plug into before integrating any particular provider.

Krypto121 remains the router.

Coinbase, Kraken and future services are interchangeable rails.

## Domain model

### Directions

```text
fiat-to-crypto
crypto-to-fiat
```

### Quote request

A normalized quote request contains:

- direction
- country
- source asset
- destination asset
- amount
- amount side (`source` or `destination`)
- source wallet where required
- destination wallet where required
- optional payment-method identifier

### Normalized quote

Every provider returns:

- provider identity
- provider quote ID
- source amount
- destination amount
- normalized fee lines
- optional exchange rate
- optional estimated duration
- expiry
- availability

Provider-specific raw responses are deliberately not part of the shared domain contract.

## Provider interface

```ts
interface FiatProvider {
  getSupportedCountries()
  getSupportedCurrencies()
  getSupportedAssets()
  getSupportedPaymentMethods()
  getQuote()
  createSession()
  getStatus()
}
```

## Router behavior

The router asks all configured providers for a quote.

Failures are isolated by provider and normalized into:

```text
unsupported
unavailable
invalid-request
authentication
rate-limited
provider-error
```

Selection follows Krypto121's standing rule:

```text
Use the lowest-cost valid route.
```

For exact-source requests, the best quote is the one delivering the most destination value.

For exact-destination requests, the best quote is the one requiring the least source value.

Only matching, available, non-expired quotes can win.

## Why this is directly reusable

Coinbase exposes buy/sell quoting and hosted/session-based on/off-ramp flows.

Kraken Ramp exposes capability discovery, quoting and hosted checkout concepts, while its broader Ramp offering advertises buy/sell.

The provider adapters can therefore normalize their different APIs into this contract without changing Krypto121 payment UX.

## No database changes

There is no migration in v0.26A.

Persistence should be added only when we create real provider sessions and need durable status/recovery.
