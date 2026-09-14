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
          +-- USDT token contract
```

## Wallet abstraction

Krypto application code should depend on a Krypto-owned wallet interface rather than directly on Privy wherever practical.

V1:

```text
Krypto -> WalletProvider -> Privy -> user wallet
```

Long-term target:

```text
Krypto -> WalletProvider -> Krypto MPC infrastructure -> user wallet
```

Custom MPC is a planned future architecture, not a V1 task. It should only be introduced after the product, transaction flows, recovery model, and security model are mature.

## Source of truth

For crypto balances, the blockchain is the source of truth.

Krypto may later cache or annotate blockchain data, but it should not invent a customer's USDT balance independently of Celo.

## Payment intent

The user should describe the desired outcome rather than manually choosing every technical rail.

Example:

```text
Spend up to 7,050 USDT
so Supplier ABC receives exactly 50,000 e-CNY.
```

That becomes a `PaymentIntent`.

The routing engine can later return one or more `PaymentQuote` objects. Each quote contains a `PaymentRoute` describing the steps necessary to settle the intent.

For V1, the route is deliberately trivial:

```text
USDT on Celo -> USDT on Celo
```

Future routes may include:

```text
swap -> bridge -> offramp -> FX -> CBDC payout
```

## Network

Development:

```text
Celo Sepolia
Chain ID: 11142220
```

Token:

```text
Test USDT
0xd077A400968890Eacc75cdc901F0356c943e4fDb
Decimals: 6
```

## e-CNY boundary

Do not model e-CNY as an ERC-20 token.

A future asset model may distinguish:

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
Authentication + embedded wallet.

### M2 — Read / Receive
Read test-USDT balance and expose the wallet address. **Current.**

### M3 — Send
User-authorized test-USDT transfer with explicit confirmation.

### M4 — Business primitives
Beneficiaries, payment memo, transaction history, export-friendly records.

### M5 — Router prototype
Payment intents, quotes, route selection, initially for simple on-chain routes.

### M6 — Gas UX
Hide native-token complexity using the safest supported Celo mechanism.

### M7 — External settlement rails
Off-ramp / FX / CBDC integrations through regulated providers.

### M8 — Mainnet preparation
Security review, monitoring, production RPC, compliance boundaries, and mainnet guardrails.

## Principle

> Krypto is the interface and orchestration layer.  
> The user controls the wallet.  
> The blockchain records the stablecoin balance.  
> The router decides how a payment should settle.
