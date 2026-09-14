# Krypto

Krypto is a business-first stablecoin payments application.

## Direction

- USDT first
- Celo first
- Non-custodial embedded wallet
- Business-oriented UX
- Payment-intent and routing architecture
- Testnet before mainnet
- Future e-CNY support through an authorized external rail, not as a Celo token
- Long-term wallet plan: replace Privy with custom Krypto MPC infrastructure behind the same wallet abstraction

## Current milestone — v0.2

This version implements:

1. Next.js + TypeScript
2. Privy authentication
3. Automatic embedded EVM wallet creation
4. A `WalletProvider` abstraction so Privy is replaceable later
5. Celo Sepolia as the development network
6. Read-only test-USDT balance from the blockchain
7. Receive panel with the real embedded-wallet address
8. Celo block-explorer link
9. Initial `PaymentIntent`, `PaymentQuote`, and `PaymentRoute` domain types

It intentionally does **not** send transactions yet.

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
```

Create a Privy application and put its App ID in `.env.local`:

```env
NEXT_PUBLIC_PRIVY_APP_ID=your_app_id
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

Then:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Expected behavior

1. Click **Create account**.
2. Authenticate through Privy.
3. Privy creates an embedded EVM wallet if the user does not already have one.
4. Krypto shows the real wallet address.
5. Krypto reads that address's test-USDT balance directly from Celo Sepolia.
6. **Receive** exposes the address and a copy button.
7. **Send** remains disabled.

## Development network

Celo Sepolia:

- Chain ID: `11142220`
- RPC: `https://forno.celo-sepolia.celo-testnet.org`
- Explorer: `https://celo-sepolia.blockscout.com`
- Test USDT: `0xd077A400968890Eacc75cdc901F0356c943e4fDb`
- USDT decimals: `6`

Production USDT on Celo mainnet:

- `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e`

Do not send real assets to the Sepolia wallet or enable production transfers yet.

## Next milestone — v0.3

- Obtain test assets safely
- Build the first user-authorized test-USDT send
- Validate recipient and amount
- Show confirmation screen before signing
- Show pending / confirmed / failed states
- Link the completed transaction to Blockscout

See `docs/ARCHITECTURE.md`.
