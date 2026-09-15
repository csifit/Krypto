import { isAddress, parseUnits } from "viem";
import { ACTIVE_PAYMENT_NETWORK } from "@/lib/celo";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { getOperationalSettings } from "@/lib/server/operations";
import { AuthError, getPrivyLinkedEvmAddresses, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      accountWalletAddress?: string;
      sourceWallet?: string;
      amount?: string;
      network?: "celo-sepolia" | "celo";
    };

    if (!body.accountWalletAddress || !isAddress(body.accountWalletAddress)) {
      return Response.json({ error: "Invalid account wallet" }, { status: 400 });
    }
    if (!body.sourceWallet || !isAddress(body.sourceWallet)) {
      return Response.json({ error: "Invalid source wallet" }, { status: 400 });
    }
    if (body.network !== "celo-sepolia" && body.network !== "celo") {
      return Response.json({ error: "Unsupported payment network" }, { status: 400 });
    }
    if (body.network !== ACTIVE_PAYMENT_NETWORK) {
      return Response.json(
        { error: "Payment network does not match the active Krypto121 environment" },
        { status: 400 },
      );
    }

    let amountUnits: bigint;
    try {
      amountUnits = parseUnits(body.amount ?? "", 18);
    } catch {
      return Response.json({ error: "Invalid payment amount" }, { status: 400 });
    }
    if (amountUnits <= BigInt(0)) {
      return Response.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    const linkedWallets = await getPrivyLinkedEvmAddresses(userId);
    if (!linkedWallets.has(body.accountWalletAddress.toLowerCase())) {
      return Response.json(
        { error: "Account wallet is not linked to this Krypto121 account" },
        { status: 403 },
      );
    }
    if (!linkedWallets.has(body.sourceWallet.toLowerCase())) {
      return Response.json(
        { error: "Source wallet is not linked to this Krypto121 account" },
        { status: 403 },
      );
    }

    const settings = await getOperationalSettings();

    if (!settings.paymentsEnabled) {
      return Response.json(
        { error: "Krypto121 payments are temporarily disabled." },
        { status: 503 },
      );
    }

    if (body.network === "celo" && !settings.mainnetPaymentsEnabled) {
      return Response.json(
        { error: "Mainnet payments are disabled." },
        { status: 503 },
      );
    }

    if (settings.maxPaymentAmount != null) {
      const maxAmountUnits = parseUnits(settings.maxPaymentAmount, 18);
      if (amountUnits > maxAmountUnits) {
        return Response.json(
          {
            error: `This payment exceeds the current maximum transaction amount of ${settings.maxPaymentAmount}.`,
          },
          { status: 403 },
        );
      }
    }

    return Response.json({ authorized: true });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("payment authorization failed", error);
    return Response.json({ error: "Could not authorize payment" }, { status: 500 });
  }
}
