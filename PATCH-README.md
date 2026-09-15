# Krypto121 v0.20.2 build fix

Replace only:

`src/lib/blockchain/usdt.ts`

The Celo-specific `eth_gasPrice(feeCurrency)` call now uses an explicit JSON-RPC request rather than viem's standard Ethereum RPC request type.

Everything else remains on viem.

Then run:

```powershell
Remove-Item -Recurse -Force .next
npm run build
```

No migration or environment change is required.
