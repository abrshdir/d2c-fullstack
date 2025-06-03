'use client';

import { createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { createPublicClient, http } from "viem";
import { injected } from "wagmi/connectors";
import { ReactNode } from "react";
import { WagmiProvider as WagmiProviderComponent } from 'wagmi';

// Configure Wagmi
const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
  },
});

export function WagmiProvider({ children }: { children: ReactNode }) {
  return <WagmiProviderComponent config={config}>{children}</WagmiProviderComponent>;
} 