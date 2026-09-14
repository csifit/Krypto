# Upgrade v0.11 — Payment requests, QR and payment links

v0.11 adds a payment-request input/output layer on top of the existing PaymentIntent flow.

## Receive flow

```text
Owned wallet
  -> optional amount
  -> optional reference
  -> PaymentRequest
  -> /pay link
  -> QR code
```

The QR and payment link represent the same request.

A request without an amount is reusable. A request with an amount/reference is suitable for a specific invoice or checkout interaction.

## Pay flow

```text
QR / payment link / wallet QR
        |
        v
PaymentRequest parser
        |
        v
PaymentIntent fields
        |
        v
Krypto121 route + quote
        |
        v
Review
        |
        v
Explicit wallet approval
```

The scanner never bypasses route review or wallet approval.

## Supported scanner inputs

- Krypto121 `/pay` URLs;
- raw EVM wallet addresses;
- simple `ethereum:` wallet URIs.

Proprietary merchant formats such as Alipay, WeChat Pay, bank QR schemes, or other closed payment-network codes are not interpreted in this milestone.

## Dependencies

- `qrcode` for QR generation;
- `@zxing/browser` for browser camera QR scanning;
- `@types/qrcode` for TypeScript types.

Run `npm install` before building.

## Database

No migration is required. Payment requests are intentionally stateless in v0.11.

A future durable request model may add request IDs, expiry, pending/paid status, reconciliation, and invoice/business metadata when there is a concrete need.
