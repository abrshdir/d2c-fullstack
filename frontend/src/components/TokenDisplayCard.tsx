"use client";

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Token } from "@/lib/api/types";
import { Coins, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface TokenDisplayCardProps {
  token: Token;
  onSelect: (token: Token) => void;
  isSelected: boolean;
}

export function TokenDisplayCard({ token, onSelect, isSelected }: TokenDisplayCardProps) {
  const [imgError, setImgError] = useState(false);

  // Get the chain name based on chainId
  const getChainName = (chainId: string) => {
    switch (chainId) {
      case "1":
        return "ethereum";
      case "137":
        return "polygon";
      case "56":
        return "bsc";
      case "42161":
        return "arbitrum";
      case "10":
        return "optimism";
      default:
        return "ethereum"; // Default to ethereum if chain not recognized
    }
  };

  const chainName = getChainName(token.chainId);
  const tokenIconUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${token.tokenAddress.toLowerCase()}/logo.png`;

  return (
    <Card className={`transition-all duration-200 ease-in-out hover:shadow-lg ${isSelected ? 'ring-2 ring-primary shadow-xl' : 'border-border'}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-muted rounded-full">
            {imgError ? (
              <Coins className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Image
                src={tokenIconUrl}
                alt={token.symbol}
                width={24}
                height={24}
                className="rounded-full"
                onError={() => setImgError(true)}
                unoptimized // Add this to bypass Next.js image optimization for external URLs
              />
            )}
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">{token.name} ({token.symbol})</CardTitle>
            <CardDescription>Value: ${token.usdValue.toFixed(2)}</CardDescription>
          </div>
        </div>
        {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{token.balanceFormatted} {token.symbol}</div>
        <p className="text-xs text-muted-foreground">Available Balance</p>
        <Button 
          onClick={() => onSelect(token)} 
          className="w-full mt-4"
          variant={isSelected ? "default" : "outline"}
          disabled={isSelected}
        >
          {isSelected ? "Selected" : "Select Token"}
        </Button>
      </CardContent>
    </Card>
  );
}
