# Krypto121 v0.5 upgrade

v0.5 is a UI simplification release. It does not change the tested payment execution logic.

## Changes

- Landing CTA: `Create account/Log in`
- Clear value proposition: user control, smart routing, transparent costs
- Main dashboard contains only:
  - My wallet
  - Balance
  - Send / Receive
- Beneficiaries moved to secondary navigation
- Payment history moved to secondary navigation
- Test/developer tools moved to secondary navigation
- Mobile hamburger menu
- Optional light/dark mode stored locally in the browser
- Development mint action renamed to `Approve transaction`

## Deliberately unchanged

- Privy embedded wallet
- Celo Sepolia
- USDTd test token
- Payment intent / quote / direct Celo route
- Local beneficiary and payment-history storage

The database/backend milestone follows after this UI structure is accepted.
