"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { initiateWithdrawal, getStakingStatus } from "@/lib/api/api";
import { WithdrawRequest, StakingStatus } from "@/lib/api/types";
import { useAccount } from "wagmi";
import { useWallet } from '@suiet/wallet-kit';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface StakingInfo {
  totalStaked: string;
  rewards: string;
  validatorAddress: string;
  startDate: string;
  isActive: boolean;
  outstandingDebt?: string;
}

export function WithdrawForm() {
  const { address: evmAddress } = useAccount();
  const { address: suiAddress } = useWallet();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const { toast } = useToast();

  const userAddress = evmAddress || suiAddress;

  useEffect(() => {
    const fetchStakingInfo = async () => {
      if (!userAddress) return;
      
      setIsLoadingInfo(true);
      try {
        const info = await getStakingStatus(userAddress);
        setStakingInfo(info as unknown as StakingInfo);
      } catch (error) {
        console.error("Error fetching staking info:", error);
        toast({
          title: "Error",
          description: "Failed to fetch staking information",
          variant: "destructive",
        });
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchStakingInfo();
  }, [userAddress, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!amount) {
      toast({
        title: "Error",
        description: "Please enter an amount to withdraw",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const request: WithdrawRequest = {
        walletAddress: userAddress,
        amount,
        tokenAddress: stakingInfo?.validatorAddress || "",
        tokenSymbol: "SUI",
      };

      const response = await initiateWithdrawal(request);
      
      // Show different messages based on whether there's outstanding debt
      if (stakingInfo?.outstandingDebt) {
        toast({
          title: "Withdrawal Initiated",
          description: `Withdrawal started. Amount: ${response.amount} SUI. Outstanding debt: ${stakingInfo.outstandingDebt} SUI will be deducted.`,
        });
      } else {
        toast({
          title: "Success",
          description: `Withdrawal initiated. Amount: ${response.amount} SUI`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingInfo) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!stakingInfo) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>No staking information found. Please stake first.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw Funds</CardTitle>
        <CardDescription>
          Unstake your funds and withdraw your rewards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Staked</span>
            <span className="font-medium">{stakingInfo.totalStaked}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current Rewards</span>
            <span className="font-medium">{stakingInfo.rewards}</span>
          </div>
          {stakingInfo.outstandingDebt && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Outstanding Debt</span>
              <span className="font-medium text-red-500">{stakingInfo.outstandingDebt}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Withdraw (SUI)</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              placeholder="Enter amount to withdraw"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-sm text-muted-foreground">
              Available: {stakingInfo.totalStaked} + {stakingInfo.rewards}
              {stakingInfo.outstandingDebt && ` - ${stakingInfo.outstandingDebt} (debt)`}
            </p>
          </div>
          <Button type="submit" disabled={isLoading || !stakingInfo.isActive}>
            {isLoading ? "Processing..." : "Withdraw"}
          </Button>
        </form>

        {stakingInfo.outstandingDebt && (
          <Alert>
            <AlertDescription>
              You have an outstanding debt of {stakingInfo.outstandingDebt} SUI. This amount will be deducted from your withdrawal.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 