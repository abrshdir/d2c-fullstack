
"use client";

import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface WalletConnectButtonProps {
  onConnect: () => Promise<void>;
  isConnected: boolean;
  walletAddress?: string;
  isLoading?: boolean;
}

export function WalletConnectButton({ 
  onConnect, 
  isConnected, 
  walletAddress,
  isLoading 
}: WalletConnectButtonProps) {
  if (isConnected) {
    return (
      <div className="flex items-center space-x-2 p-3 rounded-md border border-primary bg-secondary/30">
        <Wallet className="h-5 w-5 text-green-500" />
        <div>
          <p className="text-sm font-medium text-foreground">Wallet Connected</p>
          <p className="text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-xs">{walletAddress}</p>
        </div>
      </div>
    );
  }

  return (
    <Button onClick={onConnect} size="lg" className="w-full sm:w-auto" disabled={isLoading}>
      <Wallet className="mr-2 h-5 w-5" />
      {isLoading ? "Connecting..." : "Connect Metamask"}
    </Button>
  );
}
