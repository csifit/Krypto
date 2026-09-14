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

## Current milestone — v0.3

This version implements the first user-authorized blockchain payment flow.

1. Privy authentication and embedded EVM wallet
2. Krypto-owned `WalletProvider` abstraction
3. Celo Sepolia development network
4. Read wallet gas balance (test CELO)
5. Read development stablecoin balance
6. Receive wallet address
7. Development funding helper
8. Review screen before sending
9. User-authorized ERC-20 transfer
10. Pending / success / failure handling
11. Blockscout transaction links

## Important test-token distinction

Production remains **real USDT on Celo mainnet**.

For v0.3 we deliberately use a publicly mintable Celo Sepolia development token:

```text
USDT dummy / USDTd
0xD2B356E6E231e6fEF586A992e5e820c31673282f
Decimals: 6
```

USDTd is test money only and has no economic value. It lets us test the complete wallet-signing and ERC-20 transfer flow without asking developers to obtain real or scarce Tether test tokens.

The official Tether test deployment is retained in code for reference, but v0.3 does not use it for the wallet balance or send flow.

Production USDT on Celo mainnet remains:

```text
0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
```

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
```

Create a Privy application and add the App ID to `.env.local`:

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

## First test payment

### 1. Sign in

Open Krypto and authenticate with Privy.

### 2. Copy your wallet address

Use **Receive** or copy the address shown on the dashboard.

### 3. Get test CELO

Open the Celo Sepolia faucet from the **Get test funds** card and request test CELO for your Krypto wallet address.

Test CELO pays testnet transaction gas. It has no real-world value.

Return to Krypto and click **Refresh**.

### 4. Mint development USDT

Once the dashboard shows a positive test CELO balance, click:

```text
Mint 100 USDTd
```

Privy should ask you to approve the transaction. After confirmation, Krypto refreshes the balance.

### 5. Send a test payment

You need a second Celo Sepolia-compatible address. It may be another Krypto test account or another EVM wallet configured for Celo Sepolia.

Click **Send**, enter:

- recipient address
- amount

Krypto shows a review screen. Click **Approve & send**. Privy should ask you to authorize the blockchain transaction.

After confirmation, Krypto shows the transaction hash and a Blockscout link.

## Development network

Celo Sepolia:

- Chain ID: `11142220`
- RPC: `https://forno.celo-sepolia.celo-testnet.org`
- Explorer: `https://celo-sepolia.blockscout.com`
- Faucet: `https://faucet.celo.org/celo-sepolia`

Do not enable mainnet transfers yet.

## Next milestone — v0.4

After the first test payment is verified:

- local transaction history
- beneficiary / recipient model
- payment memo
- explicit `PaymentIntent` creation from the Send flow
- simple same-chain `PaymentRoute`
- prepare the router boundary without adding cross-chain complexity yet

See `docs/ARCHITECTURE.md`.
