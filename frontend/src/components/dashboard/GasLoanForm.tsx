"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { initiateGasLoanSwap } from "@/lib/api/api";
import { GasLoanRequest, Token } from "@/lib/api/types";
import { TokenSelection } from "@/components/TokenSelection";

export function GasLoanForm() {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToken || !amount) {
      toast({
        title: "Error",
        description: "Please select a token and enter an amount",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const request: GasLoanRequest = {
        userAddress: "", // TODO: Get from wallet
        tokenAmount: amount,
        gasDebt: "0", // TODO: Calculate based on current gas prices
        token: {
          tokenAddress: selectedToken.tokenAddress,
          chainId: selectedToken.chainId,
          symbol: selectedToken.symbol,
          name: selectedToken.name,
          decimals: selectedToken.decimals,
          balance: selectedToken.balance,
          balanceFormatted: selectedToken.balanceFormatted,
          usdValue: selectedToken.usdValue,
          address: selectedToken.tokenAddress, // Required by backend
          value: parseFloat(amount) // Required by backend - amount to swap
        }
      };

      console.log('Sending request:', JSON.stringify(request, null, 2));
      const response = await initiateGasLoanSwap(request);
      toast({
        title: "Success",
        description: `Gas loan initiated with ID: ${response.id}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate gas loan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initiate Gas Loan</CardTitle>
        <CardDescription>
          Select a token and amount to initiate a gas loan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Select Token</Label>
            <TokenSelection
              onTokenSelect={setSelectedToken}
              selectedToken={selectedToken}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Processing..." : "Initiate Gas Loan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 