# Krypto121 Architecture

## Product boundary

Krypto121 provides the user experience and payment orchestration without becoming the holder of customer wallet keys.

```text
User
  |
  | authentication
  v
Krypto121 Web App
  |
  +-- WalletProvider abstraction
  |       |
  |       +-- Privy today
  |       +-- Krypto121 MPC later
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

Krypto121 application code depends on a Krypto121-owned wallet interface rather than directly on Privy wherever practical.

V1:

```text
Krypto121 -> WalletProvider -> Privy -> user wallet
```

Long-term target:

```text
Krypto121 -> WalletProvider -> Krypto121 MPC infrastructure -> user wallet
```

Custom MPC remains a planned future architecture. It should only be introduced after the product, transaction flows, recovery model, and security model are mature.


## Wallet directory in v0.7

Krypto121 account identity is separate from wallet identity. One user may have multiple wallets.

```text
Krypto121 user
  |
  +-- Krypto121 embedded wallet
  +-- verified linked external wallet
  +-- verified linked external wallet
  +-- watch-only wallet
```

Wallet categories have different trust boundaries:

```text
Embedded
  -> user-controlled Privy wallet
  -> can sign when user authorizes

Linked external
  -> ownership verified by wallet signature through Privy
  -> can sign only when that external wallet is connected

Watch-only
  -> address metadata stored in Supabase
  -> no ownership claim
  -> no signing capability
```

Linked-wallet identity is persisted by Privy as part of the user account. Watch-only addresses are stored by Krypto121 in `watch_wallets`. Krypto121 must never ask a user to provide a seed phrase or raw private key to add a wallet.

Connected verified linked wallets may be selected as PaymentIntent sources. Watch-only wallets remain view-only and are never signing sources.

## Source of truth

For crypto balances and actual settlement, the blockchain is the source of truth.

Krypto121 may store business metadata such as beneficiaries, memos, intents, quotes, and user-friendly transaction records. Those records must not invent a token balance independently of Celo.

## v0.4 payment flow

```text
User enters recipient + amount + optional memo
        |
        v
Krypto121 creates PaymentIntent
        |
        v
Krypto121 router creates PaymentQuote
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
Krypto121 stores a local settlement record
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

Privy remains the identity provider. Krypto121 verifies the Privy access token in server-side Next.js API routes, then uses a server-only Supabase secret key.

```text
Browser
  |
  | Privy access token
  v
Krypto121 Next.js API
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
  +-- watch_wallets
```

Direct browser access to these tables is intentionally denied. RLS is enabled as defense in depth, while the Krypto121 API performs the Privy-user authorization check.

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
Privy-authenticated Krypto121 API + Supabase persistence for profile, beneficiaries, and settled payment records. Complete.

### M6 — Wallet directory
Multiple linked wallets plus watch-only wallets. Complete.

### M7 — Select payment source
Allow a connected linked wallet to become the source wallet for a PaymentIntent. Complete.

### M8 — Wallet portfolio
Read balances for owned and watch-only wallets, aggregate owned balances, and choose a receive wallet. **Current.**

### M9 — Router expansion
Add additional crypto routes only when we have a concrete need/provider.

### M10 — Gas UX
Hide native-token complexity using the safest supported Celo mechanism.

### M11 — External settlement rails
Off-ramp / FX / CBDC integrations through regulated providers.

### M12 — Mainnet preparation
Security review, monitoring, production RPC, compliance boundaries, and mainnet guardrails.

## Principle

> Krypto121 is the interface and orchestration layer.  
> The user controls the wallet.  
> The blockchain records stablecoin ownership and settlement.  
> The router decides how a payment should settle.

## v0.8 — Payment source selection

A Krypto121 account is not the same thing as one wallet.

```text
Krypto121 account
  |
  +-- embedded wallet
  +-- linked external wallet
  +-- linked external wallet
  +-- watch-only wallet
```

A `PaymentIntent` explicitly records `sourceWallet`.

Only a wallet that is currently connected and capable of signing may be selected as a source. Watch-only wallets are never eligible.

```text
Selected signing wallet
        |
        v
PaymentIntent.sourceWallet
        |
        v
Route / Quote
        |
        v
Selected wallet approves
        |
        v
Settlement
```

This keeps the routing layer independent of the wallet provider and preserves the future migration from Privy to custom Krypto121 MPC infrastructure.

## v0.9 — Wallet portfolio

Krypto121 now treats the wallet directory as a portfolio view rather than only an address list.

```text
Krypto121 account
  |
  +-- embedded wallet -------- balance read from Celo
  +-- linked wallet ---------- balance read from Celo
  +-- linked wallet ---------- balance read from Celo
  +-- watch-only wallet ------ balance read from Celo, view only
```

The main dashboard's owned USDTd total includes only the embedded wallet and ownership-verified linked wallets. Watch-only addresses are deliberately excluded because adding a watch-only address does not prove ownership.

Receive destinations follow the same ownership rule: embedded and verified linked wallets may be selected as receive addresses; watch-only addresses are not presented as owned receive destinations.

Portfolio values are display data derived from the blockchain. They are never authoritative settlement records and are not persisted as balances in Supabase.
