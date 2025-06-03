"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AccountStatusResponse } from "@/lib/api/tokenScanner";
import { TokenScannerService } from "@/lib/api/tokenScanner"; // Import the service
import { SuiStakingRequest, SuiStakingResult } from "@/lib/api/types";
import { useAccount } from "wagmi";

// Removed placeholder initiateSuiStaking function


interface SuiStakingFormProps {
  accountStatus: AccountStatusResponse | null;
  onStakingSuccess?: () => void;
}

export function SuiStakingForm({ accountStatus, onStakingSuccess }: SuiStakingFormProps) {
  const { address: evmAddress, chainId: evmChainId, isConnected } = useAccount();
  const { toast } = useToast();
  const [usdcAmountToStake, setUsdcAmountToStake] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canStake = accountStatus && parseFloat(accountStatus.outstandingDebt) === 0 && isConnected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evmAddress || !evmChainId) {
      toast({ title: "Error", description: "EVM Wallet not connected or chain ID missing.", variant: "destructive" });
      return;
    }
    if (!canStake) {
      toast({ title: "Error", description: "Staking conditions not met. Ensure outstanding debt is zero.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(usdcAmountToStake);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount to stake.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const request: SuiStakingRequest = {
        userAddress: evmAddress,
        usdcAmountToStake: usdcAmountToStake,
        // discountRate is part of the type but might be ignored by backend if EVM loan is 0.
        // For now, sending a default or allowing user input if it has other SUI-side meaning.
        discountRate: 0,
        chainId: evmChainId.toString(),
      };

      // const result = await initiateSuiStaking(request); // Call the actual API function
      // Now call the method from the imported service:
      const result = await TokenScannerService.initiateSuiStaking(request);


      if (result.success) {
        toast({
          title: "SUI Staking Initiated",
          description: `Bridging and staking process started. Bridge TX: ${result.bridgeTransactionHash}. Staked Amount: ${result.stakedAmount} SUI.`,
        });
        setUsdcAmountToStake("");
        if (onStakingSuccess) onStakingSuccess();
      } else {
        throw new Error(result.error || "SUI Staking failed to initiate.");
      }
    } catch (error) {
      toast({
        title: "Error Initiating SUI Staking",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake USDC on SUI</CardTitle>
        <CardDescription>
          Stake your USDC on the SUI network. First, ensure your EVM gas loan debt is $0.
          Then, withdraw USDC from the D2C Escrow to your EVM wallet.
          Enter the amount of USDC (from your EVM wallet) you wish to stake on SUI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && accountStatus ? (
          <>
            <p>Your EVM Wallet: <strong>{evmAddress}</strong></p>
            <p>Outstanding EVM Debt: <strong>{accountStatus.outstandingDebt} USDC</strong></p>

            {parseFloat(accountStatus.outstandingDebt) > 0 ? (
              <p className="text-red-500">You must repay your EVM outstanding debt before staking on SUI.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usdcAmountToStake">USDC Amount to Stake</Label>
                  <Input
                    id="usdcAmountToStake"
                    type="number"
                    placeholder="Enter USDC amount from your wallet"
                    value={usdcAmountToStake}
                    onChange={(e) => setUsdcAmountToStake(e.target.value)}
                    min="0.000001" // Example: min amount
                    step="any"
                    required
                  />
                   <p className="text-xs text-muted-foreground">
                    This amount will be bridged from your EVM wallet ({evmChainId ? `Chain ID: ${evmChainId}` : 'Unknown Chain'}) to SUI.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={!canStake || isLoading || !usdcAmountToStake || parseFloat(usdcAmountToStake) <= 0}
                  className="w-full"
                >
                  {isLoading ? "Processing..." : "Initiate SUI Staking"}
                </Button>
              </form>
            )}
          </>
        ) : (
          <p>{isConnected ? "Loading account status..." : "Please connect your EVM wallet."}</p>
        )}
      </CardContent>
    </Card>
  );
}
