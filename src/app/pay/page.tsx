import WalletDashboard from "@/components/WalletDashboard";
import { parsePaymentRequestParams } from "@/lib/payments/paymentRequest";
import { getPublicTrackedPaymentRequest } from "@/lib/server/paymentRequests";

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

function normalizedAmount(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function requestMatchesTracked(
  parsed: NonNullable<ReturnType<typeof parsePaymentRequestParams>>,
  tracked: NonNullable<Awaited<ReturnType<typeof getPublicTrackedPaymentRequest>>>,
) {
  return (
    parsed.requestId === tracked.id &&
    parsed.recipient.toLowerCase() === tracked.recipient.toLowerCase() &&
    parsed.asset === tracked.asset &&
    parsed.network === tracked.network &&
    Boolean(parsed.amount) &&
    normalizedAmount(parsed.amount!) === normalizedAmount(tracked.amount) &&
    (parsed.memo ?? "") === (tracked.memo ?? "")
  );
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const request = parsePaymentRequestParams(toSearchParams(values));
  let businessName: string | undefined;

  if (!request) {
    return (
      <main className="shell">
        <section className="panel setup">
          <span className="status">Invalid request</span>
          <h1 className="dashboardTitle">This payment request cannot be opened.</h1>
          <p>Ask the sender for a new Krypto121 QR code or payment link.</p>
        </section>
      </main>
    );
  }

  if (request.requestId) {
    const tracked = await getPublicTrackedPaymentRequest(request.requestId);

    if (!tracked || !requestMatchesTracked(request, tracked)) {
      return (
        <main className="shell">
          <section className="panel setup">
            <span className="status">Invalid request</span>
            <h1 className="dashboardTitle">This tracked payment request is not valid.</h1>
            <p>Ask the sender for a new Krypto121 payment link.</p>
          </section>
        </main>
      );
    }

    if (tracked.status === "paid") {
      return (
        <main className="shell">
          <section className="panel setup">
            <span className="status">Paid</span>
            <h1 className="dashboardTitle">This payment request has already been paid.</h1>
            <p>{tracked.amount} {tracked.asset}</p>
          </section>
        </main>
      );
    }

    if (tracked.status === "cancelled") {
      return (
        <main className="shell">
          <section className="panel setup">
            <span className="status">Cancelled</span>
            <h1 className="dashboardTitle">This payment request was cancelled.</h1>
            <p>Ask the sender for a new Krypto121 payment link.</p>
          </section>
        </main>
      );
    }

    businessName = tracked.businessName;
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

  return <WalletDashboard initialPaymentRequest={request} initialBusinessName={businessName} />;
}
