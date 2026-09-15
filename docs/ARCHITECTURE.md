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
Read balances for owned and watch-only wallets, aggregate owned balances, and choose a receive wallet. Complete.

### M9 — Blockchain abstraction UX
Keep blockchain mechanics out of the normal product experience while retaining technical detail for advanced users and development. Complete.

### M10 — Payment requests / QR
Generate QR/payment links for Receive and scan/open them to populate a PaymentIntent. Complete.

### M11 — Payment readiness / fee preflight
Check source balance, network-fee readiness, recipient validity, and route readiness before approval. Complete.

### M12 — Dedicated wallet management
Move My wallets to a full page with compact accordion rows and direct payment-source actions. Complete.

### M13 — Wallet names
Let users give owned wallets simple private names that follow them into Send and Receive. Complete.

### M14 — Bitcoin watch-only
Park Bitcoin addresses and monitor BTC balances without custody or signing. Complete.

### M15 — Mainnet-readiness foundations
Verify wallet ownership and blockchain settlement server-side before persisting a payment. Complete.

### M16 — Operational safety controls
Emergency payment controls, account intervention, audit history, and RPC failover foundations. Complete.

### M17 — Privileged admin security
Require MFA-backed, wallet-signed short-lived elevation before emergency administration controls. **Current.**

### M18 — Router expansion
Add Relay only when there is a real supported asset/network route to execute.

### M19 — Gas UX
Hide native-token complexity using the safest supported mechanism.

### M20 — External settlement rails
Off-ramp / FX / CBDC integrations through regulated providers.

### M21 — Controlled mainnet launch
Production RPC, monitoring, compliance boundaries, incident controls, and explicit mainnet activation.

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


## v0.10 — Blockchain abstraction UX

Krypto121 deliberately separates the user-facing payment model from the underlying blockchain implementation.

```text
Normal Krypto121 UX
  |
  +-- stablecoin balance
  +-- wallet
  +-- send / receive
  +-- network fee status
  +-- payment status

Technical details
  |
  +-- Celo Sepolia
  +-- native gas token balance
  +-- transaction hash
  +-- blockchain explorer
```

The normal wallet directory does not need to teach users what CELO is. For an owned wallet it may display a simple network-fee readiness state derived from the native-token balance. Watch-only wallets do not receive this status because they cannot authorize transactions.

This does not change the settlement implementation. Celo remains the development blockchain, and the source wallet still pays the underlying transaction fee. True gas abstraction is a later milestone.


## v0.11 — Payment requests, QR and payment links

Krypto121 adds a `PaymentRequest` input/output layer without changing the authorization boundary.

```text
Receive wallet
  -> PaymentRequest
  -> shareable /pay link
  -> QR code

QR / link / compatible wallet QR
  -> parse
  -> populate PaymentIntent
  -> route + quote
  -> review
  -> explicit user approval
```

The first PaymentRequest format contains only the data needed for the current direct test payment:

```text
version
recipient wallet
asset (USDTd)
amount (optional)
reference/memo (optional)
```

A QR code is an input mechanism, never an authorization mechanism. Scanning must never execute a transaction automatically.

v0.11 requests are stateless and encoded in the payment link. This keeps the milestone simple and avoids a database/request lifecycle before there is a concrete business need for persistent invoice-style requests.


## v0.12 — Payment readiness / fee preflight

Before a PaymentIntent advances to quote/review, Krypto121 evaluates recipient validity, stablecoin balance, estimated network-fee readiness and direct-route availability. Preflight is read-only and never signs, approves, or sends a transaction.


## v0.13 — Dedicated My wallets page

Wallet management moves from a narrow dashboard side panel to `/wallets`.

```text
My wallets
  |
  +-- one compact row per wallet
          |
          +-- basic balance / status
          +-- expandable details
          +-- Make payment from this wallet
```

The payment action does not create a new payment system. It reuses the existing Send flow and preselects the chosen signing wallet as `PaymentIntent.sourceWallet`.

Watch-only wallets remain visible but cannot be selected as payment sources. Linked wallets must be connected before they can sign.

The page structure deliberately leaves room for future wallet/network types such as Bitcoin without adding Bitcoin transaction logic yet.


## v0.14 — Wallet names

Owned wallets may have a private user-defined name such as:

```text
Company treasury
Operations
Personal
```

The name is Krypto121 account metadata only. It does not change the wallet address, provider, ownership verification, signing authority, or blockchain state.

```text
wallet address
  |
  +-- provider / ownership facts
  +-- user-defined display name
```

Names are stored server-side in `wallet_labels` and keyed by the authenticated Privy user plus wallet address.

The custom name is reused consistently in:

- My wallets
- Send source selection
- Receive destination selection

Watch-only wallets keep their existing label from `watch_wallets`.


## v0.15 — Bitcoin watch-only wallets

Bitcoin enters Krypto121 first as a read-only wallet type.

```text
My wallets
  |
  +-- Krypto121 / linked EVM wallets
  +-- EVM watch-only addresses
  +-- Bitcoin watch-only addresses
```

For a Bitcoin watch-only wallet, Krypto121 stores only:

```text
label
Bitcoin address
network type
```

Krypto121 never asks for a Bitcoin private key or seed phrase.

The balance is read from public Bitcoin blockchain data through a server-side API call. A Bitcoin watch-only wallet:

- shows BTC balance;
- can open a Bitcoin explorer;
- is excluded from owned balances;
- cannot be selected as a payment source;
- cannot sign or broadcast a transaction.

This creates the multi-network wallet-directory foundation without introducing Bitcoin transaction logic prematurely.


## v0.16 — Mainnet-readiness foundations

Krypto121 no longer accepts a browser-reported `settled` payment as sufficient proof for the durable payment record.

For the current direct Celo Sepolia route:

```text
wallet signs
   ↓
blockchain settles
   ↓
browser sends transaction hash + payment record
   ↓
Krypto121 server verifies
   +-- authenticated Privy user owns/linked the source wallet
   +-- transaction succeeded
   +-- transaction came from the expected source wallet
   +-- transaction called the expected token contract
   +-- ERC-20 transfer recipient matches
   +-- ERC-20 transfer amount matches
   +-- intent / quote / route / asset match
   ↓
payment record stored
```

The server derives `settled_at` from the blockchain block timestamp rather than trusting the browser-provided timestamp.

New durable verification metadata:

```text
verified_at
settlement_block_number
chain_id
```

A second record cannot claim the same transaction on the same network because `network + tx_hash` is unique.

This verifier is intentionally route-aware. Today it supports only the existing `direct-celo` test route. Future Relay settlement must receive its own verifier rather than bypassing this boundary.

Mainnet execution remains disabled. v0.16 improves the trust boundary; it does not turn on real-money transfers.


## v0.17 — Operational safety controls

Normal Krypto121 users remain unrestricted by default. Operational controls exist for exceptional intervention only.

Default state:

```text
user account            active
per-user restrictions   none
Krypto121 payments      enabled
maximum payment amount  no limit
mainnet payment gate    disabled
```

The `super_admin` role is stored server-side in `profiles.role`. It is never assignable through registration or a normal account setting.

A super admin may:

- suspend, block, or reactivate ordinary Krypto121 accounts;
- disable Krypto121 payment execution globally;
- control the explicit mainnet payment gate;
- optionally configure a maximum transaction amount;
- view current RPC health;
- review recent administrative audit events.

A super admin cannot sign for a user, move user funds, access a seed phrase/private key, or freeze an external self-custodial wallet. Account intervention only controls Krypto121 actions. Suspended and blocked users retain read-only access to their information.

Before a wallet authorization request is made, Krypto121 now performs a server-side execution-policy check:

```text
Payment review
   ↓
Krypto121 authorize endpoint
   +-- account is active
   +-- source wallet belongs to authenticated user
   +-- global payment switch enabled
   +-- mainnet gate enabled if the route is mainnet
   +-- optional maximum amount not exceeded
   ↓
wallet approval
```

This adds no extra user step. The check occurs immediately before wallet authorization.

Administrative changes are written to `admin_audit_log`. Ordinary user writes such as beneficiaries, watch-only wallets and wallet-name changes are also denied while an account is suspended or blocked.

Critical server-side Celo reads now use a configurable RPC transport with optional failover. Celo Forno remains the default development primary, but it is a best-effort public endpoint; a professional secondary endpoint can be configured through `CELO_SEPOLIA_RPC_SECONDARY`. The administration page reports health for both endpoints.

Mainnet transaction code remains disabled. The mainnet payment gate is an additional future safety control, not an activation mechanism by itself.


## v0.18 — Privileged Admin Security

Super Admin remains an exceptional emergency role, not part of normal user activity.

A normal Privy-authenticated session is no longer sufficient to operate `/api/admin/*`.

```text
Super Admin login
   ↓
Privy MFA enrollment required
   ↓
Krypto121 issues 5-minute one-time challenge
   ↓
embedded wallet signs challenge
   ↓
Privy MFA verifies wallet use when required
   ↓
Krypto121 verifies signature server-side
   ↓
15-minute elevated admin session
   ↓
emergency controls available
```

The challenge message makes clear that it authorizes administrative access only and cannot transfer funds.

The privileged-session token itself is never stored in Supabase. Krypto121 stores only its SHA-256 hash and sends the token to the browser in an HttpOnly, SameSite=Strict cookie scoped to `/api/admin`.

The admin session may be explicitly locked and expires automatically after 15 minutes.

This does not give Krypto121 custody over user wallets, and it places no new default limits or restrictions on normal accounts.
