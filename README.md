# Krypto

Krypto is a business-first stablecoin payments application.

## Direction

- USDT first in production
- Celo first
- Non-custodial embedded wallet
- Business-oriented UX
- Payment-intent and routing architecture
- Testnet before mainnet
- Future e-CNY support through an authorized external rail, not as a Celo token
- Long-term wallet plan: replace Privy with custom Krypto MPC infrastructure behind the same wallet abstraction

## Current milestone — v0.4

v0.4 turns the working Celo transfer into Krypto's first routed payment flow.

Implemented:

1. Privy authentication and embedded EVM wallet
2. Krypto-owned `WalletProvider` abstraction
3. Celo Sepolia + development USDTd
4. Receive and user-authorized Send
5. `PaymentIntent` creation from the Send flow
6. A first `PaymentQuote`
7. A first `PaymentRoute`: direct USDTd transfer on Celo Sepolia
8. Optional payment memo
9. Local beneficiary/address book
10. Local payment history with transaction links
11. Krypto fee explicitly shown as `0.00` in development

## Why the router exists already

The first route is intentionally boring:

```text
USDTd on Celo Sepolia
        ->
USDTd on Celo Sepolia
```

But the UI now asks Krypto for a route before the wallet signs. Later the route may become:

```text
USDT -> swap -> bridge -> off-ramp -> FX -> e-CNY payout
```

without changing the basic user action:

```text
Create payment intent -> receive quote -> approve -> settle
```

## Temporary local business data

Beneficiaries, memos, and Krypto's payment-history annotations are currently stored in browser `localStorage` under the active wallet address.

This is deliberate for v0.4 so we can validate the business workflow without introducing a database yet.

Important:

- local records are not portable across browsers/devices;
- deleting browser storage deletes those annotations;
- the blockchain remains the source of truth for actual token balances and transfers;
- a later milestone will move business records to Krypto's backend/database.

## Development token

v0.4 continues to use the publicly mintable Celo Sepolia development token:

```text
USDT dummy / USDTd
0xD2B356E6E231e6fEF586A992e5e820c31673282f
Decimals: 6
```

It has no real-world value.

Production USDT on Celo mainnet remains:

```text
0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
```

Do not enable mainnet transfers yet.

## Local setup

```powershell
npm install
npm run build
npm run dev
```

Existing `.env.local` continues to be used:

```env
NEXT_PUBLIC_PRIVY_APP_ID=your_app_id
NEXT_PUBLIC_PRIVY_CLIENT_ID=your_client_id
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

## v0.4 acceptance test

1. Sign in to Krypto.
2. Add the second test wallet as a beneficiary, for example `Test Supplier`.
3. Click **Send**.
4. Select the beneficiary.
5. Enter `1 USDTd`.
6. Add memo `Invoice TEST-001`.
7. Click **Get route & review**.
8. Confirm the review shows:
   - Direct USDTd transfer on Celo Sepolia
   - Krypto fee `0.00 USDTd`
   - network fee paid in test CELO
   - memo
9. Approve the transfer with Privy.
10. Confirm the transaction succeeds on Blockscout.
11. Confirm it appears under **Payment history**.

## Next milestone — v0.5

Once v0.4 is verified, the next logical step is a small Krypto backend/database for durable business records:

- business profile
- beneficiaries
- payment intents / quotes / settlement records
- cross-device transaction history
- tenant ownership/security

The blockchain will remain the source of truth for token ownership and transfers.

See `docs/ARCHITECTURE.md`.
