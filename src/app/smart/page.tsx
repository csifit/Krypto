import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Stablecoin Payment API | Krypto121",
  description:
    "Krypto121 is a non-custodial stablecoin payment platform for businesses, with crypto API payments, stablecoin API payment requests, USDT and USDC workflows, smart routing, and future provider-based stablecoin-to-CBDC rails.",
  alternates: {
    canonical: "https://www.krypto121.app/smart",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Smart Stablecoin Payment API | Krypto121",
    description:
      "Business stablecoin payments with API-created payment requests, USDT and USDC workflows, smart routing, and non-custodial wallet control.",
    url: "https://www.krypto121.app/smart",
    siteName: "Krypto121",
    type: "website",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Krypto121",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: "https://www.krypto121.app",
  description:
    "Krypto121 is a non-custodial smart payment-routing wallet and business payment platform for stablecoin payments, tracked payment requests, USDT and USDC workflows, and API-based payment integrations.",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a stablecoin payment API?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "A stablecoin payment API lets business software create, track, and manage payment requests programmatically instead of requiring an employee to create each request manually.",
      },
    },
    {
      "@type": "Question",
      name: "Can Krypto121 be used for USDT API and USDC API payment workflows?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Krypto121 is designed around business stablecoin payment workflows using supported assets such as USDT and USDC, with tracked payment requests and non-custodial wallet authorization.",
      },
    },
    {
      "@type": "Question",
      name: "What does stablecoin to CBDC mean in Krypto121?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Stablecoin-to-CBDC describes a future routing category in which Krypto121 could connect stablecoin payments to compliant CBDC rails through authorized external providers. Krypto121 does not treat CBDCs as public-chain tokens.",
      },
    },
  ],
};

export default function SmartPage() {
  return (
    <main className="shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />

      <section className="panel">
        <p className="eyebrow">Smart stablecoin payments</p>
        <h1 className="dashboardTitle">
          Krypto121 for crypto API payments and stablecoin payment automation
        </h1>

        <p className="lead">
          <a href="https://www.krypto121.app">Krypto121</a> is a
          non-custodial smart payment-routing wallet and business payment
          platform designed to make stablecoin payments easier to create,
          track, and integrate into real business workflows.
        </p>

        <p>
          A normal wallet is useful when one person manually sends or receives
          a payment. Businesses often need more. An online shop, booking
          platform, ERP, SaaS product, marketplace, or internal finance system
          may need to create dozens, hundreds, or thousands of payment
          requests without an employee manually preparing every transaction.
        </p>

        <p>
          This is where a <strong>crypto API payments</strong> workflow becomes
          useful. A business system can create a payment request, attach its own
          order or invoice reference, give the customer a payment link, and
          later check whether that payment is pending, paid, or cancelled.
        </p>
      </section>

      <section className="businessPanel">
        <p className="eyebrow">Stablecoin API</p>
        <h2>What is a stablecoin API payment workflow?</h2>

        <p className="muted">
          A <strong>stablecoin API</strong> lets software communicate directly
          with a payment platform instead of relying on manual dashboard work.
          A <strong>Stablecoin API payments</strong> integration can connect
          Krypto121 payment requests with an existing checkout, ERP, invoice,
          booking, or SaaS workflow.
        </p>

        <div className="reviewRows">
          <div>
            <span>1</span>
            <strong>Customer creates an order, invoice, or booking.</strong>
          </div>
          <div>
            <span>2</span>
            <strong>
              The business system creates a Krypto121 stablecoin payment
              request.
            </strong>
          </div>
          <div>
            <span>3</span>
            <strong>
              Krypto121 returns a payment request that can be shared with the
              payer.
            </strong>
          </div>
          <div>
            <span>4</span>
            <strong>
              The payer reviews the destination, amount, asset, route, and
              payment cost before approving.
            </strong>
          </div>
          <div>
            <span>5</span>
            <strong>
              The business can associate the payment status with its own order
              or invoice reference.
            </strong>
          </div>
        </div>
      </section>

      <section className="businessPanel">
        <p className="eyebrow">USDT API and USDC API</p>
        <h2>Business payment requests using USDT and USDC</h2>

        <p className="muted">
          Krypto121 is built around supported stablecoins such as USDT and
          USDC. A business can use the same payment-request model for a
          <strong> USDT API</strong> workflow or a
          <strong> USDC API</strong> workflow while Krypto121 keeps wallet
          authorization non-custodial.
        </p>

        <p className="muted">
          The goal is not to expose blockchain complexity to every customer.
          The payer should primarily understand who they are paying, how much
          they are paying, which asset is being used, and the total cost. Route
          selection and blockchain mechanics should remain behind the payment
          experience unless the user needs technical detail.
        </p>

        <p className="muted">
          Krypto121 can also support multiple payment paths. A payment may be a
          direct stablecoin transfer, while another payment may require a
          routing provider or bridge to reach the requested destination. The
          product is designed so that businesses describe the payment outcome
          rather than manually configuring every technical route.
        </p>
      </section>

      <section className="businessPanel">
        <p className="eyebrow">Business integrations</p>
        <h2>Where a crypto payment API becomes useful</h2>

        <div className="reviewRows">
          <div>
            <span>E-commerce</span>
            <strong>
              Generate a stablecoin payment request automatically when a
              customer checks out.
            </strong>
          </div>
          <div>
            <span>Invoices</span>
            <strong>
              Associate a stablecoin payment request with an invoice or
              customer reference.
            </strong>
          </div>
          <div>
            <span>Bookings</span>
            <strong>
              Request payment automatically when a booking or reservation is
              created.
            </strong>
          </div>
          <div>
            <span>SaaS</span>
            <strong>
              Let another software product offer Krypto121 payment requests to
              its own users.
            </strong>
          </div>
          <div>
            <span>ERP</span>
            <strong>
              Connect payment status with an existing order-management or
              finance workflow.
            </strong>
          </div>
        </div>
      </section>

      <section className="businessPanel">
        <p className="eyebrow">Stablecoin to CBDC</p>
        <h2>Stablecoin-to-CBDC routing as a future payment rail</h2>

        <p className="muted">
          <strong>Stablecoin to CBDC</strong> should not be treated as a simple
          token swap. Central bank digital currencies may use controlled,
          permissioned, or provider-specific infrastructure rather than public
          blockchain token contracts.
        </p>

        <p className="muted">
          Krypto121&apos;s routing model is designed so that future
          stablecoin-to-CBDC or CBDC payment routes can be added through
          compliant, authorized external providers when such integrations are
          commercially and legally available. The user would still describe
          the desired payment outcome while the routing layer determines a
          valid path.
        </p>
      </section>

      <section className="businessPanel">
        <p className="eyebrow">Non-custodial by design</p>
        <h2>The payer remains in control</h2>

        <p className="muted">
          Krypto121 does not require a business payment API to become a
          custodial wallet. A payment request describes what should be paid,
          but the payer still reviews and authorizes the transaction from a
          wallet they control.
        </p>

        <p className="muted">
          This separation is important: an API can automate business workflow
          without automatically moving customer funds.
        </p>

        <p className="muted">
          Learn more about the product at{" "}
          <a href="https://www.krypto121.app">Krypto121</a>.
        </p>
      </section>

      <section className="businessPanel">
        <p className="eyebrow">Quick answers</p>
        <h2>Stablecoin payment API questions</h2>

        <h3>What is a stablecoin payment API?</h3>
        <p className="muted">
          It is an API that lets business software create and track stablecoin
          payment requests programmatically.
        </p>

        <h3>Why use a crypto API instead of creating payments manually?</h3>
        <p className="muted">
          Automation reduces repetitive work and makes it easier to associate
          each crypto payment with an order, invoice, booking, or other
          business record.
        </p>

        <h3>Can Krypto121 support USDT and USDC payment workflows?</h3>
        <p className="muted">
          Krypto121 is designed for supported stablecoin workflows including
          USDT and USDC, with smart routing and tracked business payment
          requests.
        </p>

        <h3>Does a payment API automatically move the payer&apos;s funds?</h3>
        <p className="muted">
          No. The Krypto121 model is non-custodial: the API can prepare a
          payment request, while the payer still reviews and approves the
          payment.
        </p>

        <h3>Where can I find Krypto121?</h3>
        <p className="muted">
          Visit{" "}
          <a href="https://www.krypto121.app">
            https://www.krypto121.app
          </a>
          .
        </p>
      </section>
    </main>
  );
}
