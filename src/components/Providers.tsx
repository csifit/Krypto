"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { celoSepolia } from "@/lib/celo";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Keep the app viewable before Privy credentials are added.
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: celoSepolia,
        supportedChains: [celoSepolia],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
