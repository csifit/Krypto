import WalletDashboard from "@/components/WalletDashboard";
import { parsePaymentRequestParams } from "@/lib/payments/paymentRequest";

function toSearchParams(
  values: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }

  return params;
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const request = parsePaymentRequestParams(toSearchParams(values));

  if (!request) {
    return (
      <main className="shell">
        <section className="panel setup">
          <span className="status">Invalid request</span>
          <h1 className="dashboardTitle">This payment request cannot be opened.</h1>
          <p>
            Ask the sender for a new Krypto121 QR code or payment link.
          </p>
        </section>
      </main>
    );
  }

  const privyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  if (!privyConfigured) {
    return (
      <main className="shell">
        <section className="panel setup">
          <span className="status">Setup required</span>
          <h2>Connect Privy</h2>
          <p>Wallet authentication must be configured before a payment can be approved.</p>
        </section>
      </main>
    );
  }

  return <WalletDashboard initialPaymentRequest={request} />;
}
