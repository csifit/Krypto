# Upgrade v0.14 — Wallet names

v0.14 lets users give their owned wallets simple private names.

Examples:

```text
Krypto121 wallet -> Company treasury
MetaMask -> Operations
External wallet -> Personal
```

## What changes

On `/wallets`, open an owned wallet accordion and choose **Rename**.

The saved name is then reused in:

- the My wallets top row;
- Send → Pay from;
- Receive → Receive into.

The wallet address and provider remain unchanged.

A user may choose **Use default name** to remove the custom name.

Watch-only wallets keep the label they were created with.

## Database

Apply:

```text
supabase/migrations/202609140003_wallet_labels.sql
```

This creates `wallet_labels`.

Browser access remains denied by RLS. The authenticated Krypto121 API is the only application path.

## Environment

No new environment variables are required.
