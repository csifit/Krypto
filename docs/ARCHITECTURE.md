# Krypto Architecture

## Product boundary

Krypto provides the user experience and payment orchestration without becoming the holder of customer wallet keys.

```text
User
  |
  | authentication
  v
Krypto Web App
  |
  +-- WalletProvider abstraction
  |       |
  |       +-- Privy today
  |       +-- Krypto MPC later
  |
  +-- Payment Intent
  |       |
  |       +-- Quote
  |       +-- Route
  |
  +-- Celo RPC
          |
          +-- stablecoin contract
```

## Wallet abstraction

Krypto application code depends on a Krypto-owned wallet interface rather than directly on Privy wherever practical.

V1:

```text
Krypto -> WalletProvider -> Privy -> user wallet
```

Long-term target:

```text
Krypto -> WalletProvider -> Krypto MPC infrastructure -> user wallet
```

Custom MPC remains a planned future architecture. It should only be introduced after the product, transaction flows, recovery model, and security model are mature.

## Source of truth

For crypto balances and actual settlement, the blockchain is the source of truth.

Krypto may store business metadata such as beneficiaries, memos, intents, quotes, and user-friendly transaction records. Those records must not invent a token balance independently of Celo.

## v0.4 payment flow

```text
User enters recipient + amount + optional memo
        |
        v
Krypto creates PaymentIntent
        |
        v
Krypto router creates PaymentQuote
        |
        v
Quote contains PaymentRoute
        |
        v
User reviews route + fees
        |
        v
WalletProvider requests authorization
        |
        v
Privy user wallet signs / submits
        |
        v
Celo Sepolia confirms
        |
        v
Krypto stores a local settlement record
```

The current route contains one step:

```text
transfer
provider: Celo
description: Direct USDTd transfer on Celo Sepolia
```

This establishes the router boundary without adding unnecessary cross-chain infrastructure.

## Payment intent

A `PaymentIntent` describes the desired outcome, not the technical execution path.

Current example:

```text
Send 10 USDTd from wallet A
to wallet B
memo: Invoice TEST-001
```

Future example:

```text
Spend up to 7,050 USDT
so Supplier ABC receives exactly 50,000 e-CNY.
```

The routing engine can later compare multiple `PaymentQuote` objects with different `PaymentRoute` steps.

Future route steps may include:

```text
swap -> bridge -> offramp -> FX -> CBDC payout
```

## Durable business records in v0.6

Privy remains the identity provider. Krypto verifies the Privy access token in server-side Next.js API routes, then uses a server-only Supabase secret key.

```text
Browser
  |
  | Privy access token
  v
Krypto Next.js API
  |
  | verifies token with Privy
  v
Privy user ID
  |
  v
Supabase (server-only access)
  +-- profiles
  +-- beneficiaries
  +-- payments
```

Direct browser access to these tables is intentionally denied. RLS is enabled as defense in depth, while the Krypto API performs the Privy-user authorization check.

The database stores business metadata only. Celo remains authoritative for balances and settlement.

## Test token strategy

Development:

```text
USDT dummy / USDTd on Celo Sepolia
0xD2B356E6E231e6fEF586A992e5e820c31673282f
Decimals: 6
```

Production target:

```text
USDT on Celo mainnet
0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
```

Never infer production token configuration from the development token.

## e-CNY boundary

Do not model e-CNY as an ERC-20 token.

A future asset model distinguishes:

```text
crypto:
  USDT on Celo
  USDC on supported chains

fiat:
  USD
  CNY

cbdc:
  e-CNY through an authorized external provider
```

A future USDT -> e-CNY route crosses from public blockchain infrastructure into an authorized external settlement rail.

## Milestones

### M1 — Account
Authentication + embedded wallet. Complete.

### M2 — Read / Receive
Read balance and expose wallet address. Complete.

### M3 — Send
User-authorized test stablecoin transfer. Complete.

### M4 — Business primitives + router boundary
Beneficiaries, memo, payment intents, quote, and direct route. Complete.

### M5 — Durable backend
Privy-authenticated Krypto API + Supabase persistence for profile, beneficiaries, and settled payment records. **Current.**

### M6 — Router expansion
Add additional crypto routes only when we have a concrete need/provider.

### M7 — Gas UX
Hide native-token complexity using the safest supported Celo mechanism.

### M8 — External settlement rails
Off-ramp / FX / CBDC integrations through regulated providers.

### M9 — Mainnet preparation
Security review, monitoring, production RPC, compliance boundaries, and mainnet guardrails.

## Principle

> Krypto is the interface and orchestration layer.  
> The user controls the wallet.  
> The blockchain records stablecoin ownership and settlement.  
> The router decides how a payment should settle.
