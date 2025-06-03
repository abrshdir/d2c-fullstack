"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ScanLine } from "lucide-react";
import type { Token } from "@/lib/api/types";
import { TokenDisplayCard } from "./TokenDisplayCard";
import { TokenScannerService } from "@/lib/api/tokenScanner";
import { useToast } from "@/hooks/use-toast";

interface TokenSelectionProps {
  onTokenSelect: (token: Token) => void;
  selectedToken: Token | null;
  walletAddress?: string;
}

export function TokenSelection({
  onTokenSelect,
  selectedToken,
  walletAddress,
}: TokenSelectionProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const hasScanned = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (walletAddress && !hasScanned.current) {
      hasScanned.current = true;
      handleScanWallet();
    }
  }, [walletAddress]);

  const handleScanWallet = async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await TokenScannerService.scanWallet(walletAddress);
      if (data?.hasStrandedValue && Array.isArray(data?.topTokens)) {
        setTokens(data.topTokens);
        toast({
          title: "Tokens Found",
          description: `Found ${data.topTokens.length} tokens in your wallet.`,
        });
      } else {
        setTokens([]);
        toast({
          title: "No Tokens Found",
          description: "No tokens with sufficient value found in your wallet.",
          variant: "destructive",
        });
      }
      setScanComplete(true);
    } catch (error) {
      console.error("Error scanning wallet:", error);
      setError(
        error instanceof Error ? error.message : "Failed to scan wallet for tokens."
      );
      toast({
        title: "Scan Error",
        description: error instanceof Error ? error.message : "Failed to scan wallet for tokens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectToken = (token: Token) => {
    onTokenSelect(token);
  };
  
  const handleProceed = () => {
    if (selectedToken) {
      onTokenSelect(selectedToken);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Select Token</CardTitle>
        <CardDescription>Choose a token from your wallet for the gasless transaction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!tokens.length && !loading && (
          <Button onClick={handleScanWallet} className="w-full" size="lg">
            <ScanLine className="mr-2 h-5 w-5" />
            Scan Wallet for Tokens
          </Button>
        )}
        
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Scanning your wallet...</p>
          </div>
        )}

        {tokens.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-center">Your Top Tokens</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tokens.map((token) => (
                <TokenDisplayCard 
                  key={token.tokenAddress} 
                  token={token} 
                  onSelect={handleSelectToken}
                  isSelected={selectedToken?.tokenAddress === token.tokenAddress}
                />
              ))}
            </div>
            <Button 
              onClick={handleProceed} 
              disabled={!selectedToken || loading} 
              className="w-full mt-6"
              size="lg"
            >
              Proceed with {selectedToken ? selectedToken.symbol : 'Selected Token'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
