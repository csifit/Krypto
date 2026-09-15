# Krypto121 v0.26A — Fiat Routing Foundation

This is a provider-neutral foundation only.

It does not expose fiat payments in the UI yet and it does not contain a Coinbase or Kraken implementation.

## Added

```text
src/lib/fiat/types.ts
src/lib/fiat/provider.ts
src/lib/fiat/router.ts
src/lib/fiat/index.ts
```

## FiatProvider contract

Every future fiat rail implements the same interface:

```text
getSupportedCountries()
getSupportedCurrencies()
getSupportedAssets()
getSupportedPaymentMethods()
getQuote()
createSession()
getStatus()
```

This lets Krypto121 integrate Coinbase, Kraken and future providers without making any provider the product architecture.

## Both directions

The domain model supports:

```text
fiat-to-crypto
crypto-to-fiat
```

Examples:

```text
EUR → USDC
USDC → EUR
USD → USDT
USDT → USD
```

A fiat-to-crypto quote requires a destination wallet.

A crypto-to-fiat quote requires a source wallet.

## Quote routing

`collectFiatQuotes()` requests quotes from all configured providers independently.

One provider failing does not prevent another provider from returning a valid quote.

`selectBestFiatQuote()` then selects among valid, non-expired quotes.

For an exact source amount:

```text
I will spend 500 EUR
```

Krypto121 chooses the quote with the highest destination amount.

For an exact destination amount:

```text
Recipient should receive 500 EUR
```

Krypto121 chooses the quote requiring the lowest source amount.

If outcomes are equal, the shorter estimated duration wins. A provider ID tie-break makes the result deterministic.

The comparison uses decimal-string comparison instead of JavaScript floating-point arithmetic.

## Provider responsibility

A provider adapter remains responsible for mapping its own:

- countries
- currencies
- assets/networks
- payment methods
- quote identifiers
- hosted/session flow
- transaction status

into Krypto121's normalized domain model.

## Not included yet

- Coinbase adapter
- Kraken adapter
- API credentials
- provider-specific environment variables
- database migration
- fiat UI
- bank details
- KYC data storage
- webhooks

There are no fake provider routes.

## Build

This package is an overlay for the existing v0.25 source.

After replacing/adding the files:

```powershell
Remove-Item -Recurse -Force .next
npm run build
```

No Supabase migration is required for this foundation step.
