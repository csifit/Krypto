"use client";

import WalletDashboard from "@/components/WalletDashboard";

export default function Home() {
  const privyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  if (!privyConfigured) {
    return (
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Krypto · Development</p>
            <h1>Business payments with digital dollars.</h1>
            <p className="lead">
              The first milestone is a user-owned embedded wallet running on
              Celo Sepolia with test USDT.
            </p>
          </div>
        </section>

        <section className="panel setup">
          <span className="status">Setup required</span>
          <h2>Connect Privy</h2>
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code> and add
            your Privy App ID. Then restart the development server.
          </p>
        </section>
      </main>
    );
  }

  return <WalletDashboard />;
}
