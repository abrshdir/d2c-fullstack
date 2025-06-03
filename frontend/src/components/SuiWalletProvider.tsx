"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { WalletProvider, useWallet } from "@suiet/wallet-kit";
import "@suiet/wallet-kit/style.css";

interface SuiWalletContextType {
  address: string | null;
  connected: boolean;
  account: any | null;
  select: (walletName: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // Add other wallet states and functions as needed (e.g., signTransaction, signMessage)
}

const SuiWalletContext = createContext<SuiWalletContextType | undefined>(
  undefined
);

interface SuiWalletProviderProps {
  children: ReactNode;
  onConnect?: (address: string | null) => void; // Callback for when connection status changes
}

// Actual implementation using Suiet wallet kit
const ActualSuiWalletLogic = ({
  children,
  onConnect,
}: SuiWalletProviderProps) => {
  const wallet = useWallet();

  useEffect(() => {
    // Call onConnect callback when wallet connection status changes
    if (wallet.connected && wallet.account?.address) {
      if (onConnect) onConnect(wallet.account.address);
    } else if (!wallet.connected && onConnect) {
      onConnect(null);
    }
  }, [wallet.connected, wallet.account, onConnect]);

  const connect = async () => {
    try {
      // This will trigger the wallet selection modal
      // Try to select an available wallet (Slush instead of suiet)
      await wallet.select("Slush");
      console.log("SUI Wallet connected:", wallet.account?.address);
    } catch (error) {
      console.error("Error connecting to SUI wallet:", error);
    }
  };

  const disconnect = async () => {
    try {
      await wallet.disconnect();
      console.log("SUI Wallet disconnected");
    } catch (error) {
      console.error("Error disconnecting SUI wallet:", error);
    }
  };

  return (
    <SuiWalletContext.Provider
      value={{
        address: wallet.account?.address || null,
        connected: wallet.connected,
        account: wallet.account,
        select: wallet.select,
        connect,
        disconnect,
      }}
    >
      {children}
    </SuiWalletContext.Provider>
  );
};

export const SuiWalletProvider = ({
  children,
  onConnect,
}: SuiWalletProviderProps) => {
  // Using the actual Suiet wallet provider
  return (
    <WalletProvider autoConnect>
      <ActualSuiWalletLogic onConnect={onConnect}>
        {children}
      </ActualSuiWalletLogic>
    </WalletProvider>
  );
};

// Hook to use the SUI wallet context
export const useSuiWallet = () => {
  const context = useContext(SuiWalletContext);
  if (context === undefined) {
    throw new Error("useSuiWallet must be used within a SuiWalletProvider");
  }
  return context;
};

// Optional: A component that uses the SUI wallet hook to display status or a connect button
export const SuiConnectButton = () => {
  const { connected, connect, select, disconnect, address } = useSuiWallet();

  const handleConnect = async () => {
    try {
      // This will trigger the wallet selection modal
      await select("Slush");
    } catch (error) {
      console.error("Error connecting to SUI wallet:", error);
      // Try alternative wallet name if first one fails
      try {
        await select("Slush — A Sui wallet");
      } catch (altError) {
        console.error("Error connecting to alternative SUI wallet:", altError);
      }
    }
  };

  if (connected) {
    return (
      <div>
        <p>
          SUI Connected:{" "}
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "N/A"}
        </p>
        <button
          onClick={disconnect}
          className="p-2 bg-red-500 text-white rounded"
        >
          Disconnect SUI Wallet
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="p-2 bg-blue-500 text-white rounded"
    >
      Connect SUI Wallet
    </button>
  );
};
