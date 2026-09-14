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

Custom MPC is a planned future architecture, not a V1 task. It should only be introduced after the product, transaction flows, recovery model, and security model are mature.

In v0.3 the abstraction exposes:

- wallet address
- chain switching
- a standard EIP-1193 signing/transaction provider

This keeps blockchain transaction code independent of Privy's UI-specific hooks.

## Source of truth

For crypto balances, the blockchain is the source of truth.

Krypto may later cache or annotate blockchain data, but it should not invent a customer's stablecoin balance independently of Celo.

## Test token strategy

Production target:

```text
USDT on Celo mainnet
0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
```

Development v0.3 uses:

```text
USDT dummy / USDTd on Celo Sepolia
0xD2B356E6E231e6fEF586A992e5e820c31673282f
Decimals: 6
```

USDTd is publicly mintable test money and has no real-world value.

The development token is intentionally separate from production USDT. Never infer a production token address from the active test token configuration.

## Payment authorization

The transaction path in v0.3 is:

```text
User enters recipient + amount
        |
        v
Krypto validates
        |
        v
Krypto review screen
        |
        v
User selects Approve & send
        |
        v
WalletProvider requests transaction authorization
        |
        v
Privy user wallet signs / submits
        |
        v
Celo Sepolia confirms
        |
        v
Krypto refreshes blockchain balance
```

Krypto does not keep a backend signing key.

## Payment intent

The user should eventually describe the desired outcome rather than manually choosing every technical rail.

Example:

```text
Spend up to 7,050 USDT
so Supplier ABC receives exactly 50,000 e-CNY.
```

That becomes a `PaymentIntent`.

The routing engine can later return one or more `PaymentQuote` objects. Each quote contains a `PaymentRoute` describing the steps necessary to settle the intent.

For the first route, keep it trivial:

```text
stablecoin on Celo -> stablecoin on Celo
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

The user needs test CELO for gas in v0.3. Gas abstraction is intentionally postponed until the basic signing and transfer flow is proven.

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
Authentication + embedded wallet. Complete.

### M2 — Read / Receive
Read balance and expose wallet address. Complete.

### M3 — Send
User-authorized test stablecoin transfer with explicit confirmation. **Current.**

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
