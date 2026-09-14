# Krypto121

**Krypto121 is a smart payment-routing wallet. Create a wallet or bring the wallets you already use. Manage them from one place.**

Krypto121 is currently a testnet, business-first stablecoin payments application.

## v0.11 — Payment requests, QR and payment links

v0.11 adds two complementary payment flows:

```text
Receive
  -> choose owned wallet
  -> optional amount + reference
  -> create QR + shareable payment link
```

and:

```text
Send
  -> scan QR or open payment link
  -> PaymentIntent fields are populated
  -> Krypto121 route/quote
  -> user reviews
  -> user approves
```

### Receive / request payment

The Receive panel can now create:

- a reusable QR when no amount is entered;
- a specific payment request when amount/reference are entered;
- a shareable `/pay` link;
- a QR encoding the same payment link.

A payer who opens the link sees the payment request before signing in. After login/account creation, Krypto121 opens Send with recipient, amount and reference already populated.

### Scan to pay

Send now includes **Scan QR**. The scanner supports:

- Krypto121 payment request QR codes;
- raw EVM wallet-address QR codes;
- simple `ethereum:` wallet URIs;
- pasted Krypto121 payment links or wallet addresses as a fallback.

Camera scanning uses `@zxing/browser`. QR generation uses `qrcode`.

### Safety rule

> Scanning a QR code never sends funds.

QR/payment-link data only populates a PaymentIntent. The payer still sees the existing route review and must explicitly approve the transaction.

### Deliberate v0.11 boundary

Payment requests are stateless in this first version: the payment link contains the recipient, optional amount and reference. Krypto121 does not yet persist request status such as `pending` / `paid`. Durable invoice-style requests can be added later when needed.

No Supabase migration is required.
No new environment variables are required.

## Install / upgrade

v0.11 adds npm dependencies, so run:

```bash
npm install
npm run build
npm run dev
```

## Acceptance test

1. Open **Receive**.
2. Choose an owned wallet.
3. Leave amount empty, create a request and confirm a QR + link appear.
4. Enter an amount and reference, regenerate, and confirm both are represented in the payment request.
5. Copy the link and open it in a private/incognito browser.
6. Confirm the request is shown before login.
7. Login/create an account and confirm Send opens with recipient, amount and reference populated.
8. On another logged-in Krypto121 session, open **Send → Scan QR** and scan the generated QR.
9. Confirm the same payment details populate without sending anything automatically.
10. Review and approve a small USDTd payment and confirm the existing settlement/history flow still works.
11. Scan a QR containing only a raw EVM wallet address and confirm Krypto121 fills only the recipient, leaving amount/reference for the payer.
12. Deny camera permission and confirm the paste-payment-link fallback still works.

See `docs/ARCHITECTURE.md` and `docs/upgrades/UPGRADE-v0.11.md`.
