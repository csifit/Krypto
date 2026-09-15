# Upgrade v0.19 — Real USDT on Celo Mainnet

## Database

No Supabase migration is required.

## Environment selection

The same codebase now has two durable environments:

```text
testnet -> Celo Sepolia + USDTd
mainnet -> Celo Mainnet + real USDT
```

Local development:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

Vercel Production:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=mainnet
```

## Mainnet asset

```text
Network: Celo Mainnet
Chain ID: 42220
USDT: 0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
Decimals: 6
```

## Mainnet RPC

Optional server settings:

```text
CELO_MAINNET_RPC_PRIMARY=https://forno.celo.org
CELO_MAINNET_RPC_SECONDARY=
```

The secondary is optional but recommended before meaningful real-money volume.

## Existing operational controls

Mainnet execution still requires the Super Admin Mainnet payment gate.

After deploying the production environment:

1. Sign in.
2. Confirm the dashboard shows `USDT` and `Mainnet`.
3. Open `/admin`.
4. Complete privileged verification.
5. Confirm RPC health is for Celo Mainnet.
6. Turn `Mainnet payment gate` ON.
7. Save operational settings.

The default maximum payment amount remains `No limit`.

## Important

Do not use the test-fund mint flow on mainnet. Krypto121 hides it automatically in a mainnet build and the mint helper rejects mainnet execution.

Payment request v2 embeds the selected network and asset. Old v1 test links are not accepted in mainnet.

Until gas abstraction is implemented, the sender needs native network funds for transaction fees.
