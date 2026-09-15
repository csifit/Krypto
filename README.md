# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

## v0.19 — Real USDT on Celo Mainnet

v0.19 adds a real production payment environment while preserving Celo Sepolia as the permanent development/test environment.

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
  -> Celo Sepolia
  -> USDTd development token
  -> test payment requests
  -> test settlement verification

NEXT_PUBLIC_KRYPTO_NETWORK=mainnet
  -> Celo Mainnet (chain ID 42220)
  -> real Tether USDT
  -> real balance reads
  -> real payment requests
  -> real direct USDT transfers
  -> mainnet settlement verification
```

### Production USDT

Celo Mainnet USDT:

```text
0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e
decimals: 6
```

### Safety boundaries retained

- the authenticated Privy user must own/link the source wallet;
- account must be active;
- global payment execution must be enabled;
- the Mainnet payment gate must be enabled for mainnet;
- optional maximum transaction amount remains available but defaults to no limit;
- wallet approval remains mandatory;
- settled payments are verified against the blockchain before storage;
- duplicate transaction recording is prevented;
- Super Admin emergency controls remain MFA/elevated-session protected.

### Payment requests

New payment links use request format v2 and include both asset and network. This prevents a Celo Sepolia USDTd request from being mistaken for a Celo Mainnet USDT request.

Old v1 requests remain accepted only in the testnet environment.

### Payment history

The API returns payment records for the active environment only. Historical Sepolia test payments remain in Supabase but are not mixed into the mainnet payment history.

### RPC

Server-side settlement verification uses the RPC settings for the active environment.

Optional production variables:

```text
CELO_MAINNET_RPC_PRIMARY=https://forno.celo.org
CELO_MAINNET_RPC_SECONDARY=
```

Forno is the fallback/default primary. Configure an independent professional secondary RPC before meaningful production volume.

### Go-live

There is no database migration in v0.19.

For local development keep:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=testnet
```

For Vercel Production set:

```text
NEXT_PUBLIC_KRYPTO_NETWORK=mainnet
```

Then deploy and, after verifying the live dashboard says Mainnet / USDT, unlock `/admin` and turn **Mainnet payment gate** ON.

Gas abstraction is not included in v0.19. Until the next milestone, a sending wallet still needs enough native network funds for transaction fees.
