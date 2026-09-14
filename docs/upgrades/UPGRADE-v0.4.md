# Krypto121 v0.4 Upgrade

Replace/add the files in this package over the current Krypto121 root.

## New files

- `src/components/BeneficiariesPanel.tsx`
- `src/components/PaymentHistory.tsx`
- `src/lib/payments/directCelo.ts`
- `src/lib/payments/localStore.ts`

## Replaced files

- `src/components/SendPanel.tsx`
- `src/components/WalletDashboard.tsx`
- `src/lib/payments/types.ts`
- `src/lib/blockchain/usdt.ts`
- `src/app/globals.css`
- `docs/ARCHITECTURE.md`
- `README.md`
- `tsconfig.json`
- `package.json`

Your `.env.local` is not included and should remain unchanged.

## Verify

```powershell
npm install
npm run build
npm run dev
```

Then run the v0.4 acceptance test in `README.md`.
