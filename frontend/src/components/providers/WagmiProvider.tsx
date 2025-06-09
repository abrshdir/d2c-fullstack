'use client';

import { createConfig } from "wagmi";
import { mainnet, polygon } from "wagmi/chains";
import { createPublicClient, http } from "viem";
import { injected } from "wagmi/connectors";
import { ReactNode } from "react";
import { WagmiProvider as WagmiProviderComponent } from 'wagmi';

// Configure Wagmi
const config = createConfig({
  chains: [mainnet, polygon],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
  },
});

export function WagmiProvider({ children }: { children: ReactNode }) {
  return <WagmiProviderComponent config={config}>{children}</WagmiProviderComponent>;
} 