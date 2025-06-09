"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import {
  SuiWalletProvider,
  SuiConnectButton,
} from "@/components/SuiWalletProvider";
import { useAccount } from "wagmi";
import { useWallet } from '@suiet/wallet-kit';
import { WithdrawForm } from "@/components/dashboard/WithdrawForm";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { ActivityLog } from "@/components/dashboard/ActivityLog";
import { StakingForm } from "@/components/dashboard/StakingForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Import API functions
import {
  getStakingStatus,
  getTransactionHistory,
} from "../../lib/api/api";
import type { StakingStatus, TransactionHistory } from "../../lib/api/types";

interface StakingInfo {
  totalStaked: string;
  rewards: string;
  validatorAddress: string;
  startDate: string;
  isActive: boolean;
}

interface Activity {
  id: string;
  type: "DEPOSIT" | "SWAP" | "BRIDGE" | "STAKE" | "WITHDRAW" | "REWARD" | "GAS_LOAN";
  status: "PENDING" | "COMPLETED" | "FAILED";
  amount: string;
  timestamp: string;
  transactionHash?: string;
  fromChain?: string;
  toChain?: string;
  fromToken?: string;
  toToken?: string;
  validatorAddress?: string;
  error?: string;
}

export default function DashboardPage() {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { connected: isSuiConnected, address: suiAddress } = useWallet();
  const [stakingStatus, setStakingStatus] = useState<StakingInfo | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userAddress = evmAddress || suiAddress;

  const mapTransactionToActivity = (tx: TransactionHistory): Activity => ({
    id: tx.id,
    type: tx.type as Activity['type'],
    status: tx.status as Activity['status'],
    amount: tx.amount,
    timestamp: tx.timestamp,
    transactionHash: tx.transactionHash,
  });

  const fetchDashboardData = async () => {
    if (!userAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const [stakingStatusResult, transactionHistoryResult] = await Promise.all([
        getStakingStatus(userAddress),
        getTransactionHistory({ page: 1, limit: 10 }),
      ]);

      setStakingStatus(stakingStatusResult as unknown as StakingInfo);
      setTransactionHistory(Array.isArray(transactionHistoryResult) ? transactionHistoryResult.map(mapTransactionToActivity) : []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [userAddress]);

  return (
    <SuiWalletProvider>
      <div className="container mx-auto p-4 md:p-8">
        {!isEvmConnected && !isSuiConnected ? (
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Connect Your Wallets</CardTitle>
              <CardDescription>
                Please connect your EVM and SUI wallets to view your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">
                  EVM Wallet (e.g., MetaMask)
                </h3>
                <WalletConnectButton
                  onConnect={async () => {
                    console.log("Attempting to connect EVM wallet...");
                  }}
                  isConnected={isEvmConnected}
                  walletAddress={evmAddress || undefined}
                />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">SUI Wallet</h3>
                <SuiConnectButton />
              </div>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <header className="mb-8">
              <h1 className="text-3xl font-bold">Staking Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back,{" "}
                {userAddress
                  ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                  : "Guest"}
              </p>
            </header>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
              <DashboardMetrics stakingStatus={stakingStatus} />
            </div>

            <Tabs defaultValue="staking" className="space-y-4">
              <TabsList>
                <TabsTrigger value="staking">Staking</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>

              <TabsContent value="staking">
                <StakingForm />
              </TabsContent>

              <TabsContent value="withdraw">
                <WithdrawForm />
              </TabsContent>
            </Tabs>

            <div className="mt-8">
              <ActivityLog
                activities={transactionHistory}
                isLoading={isLoading}
                error={error || undefined}
                onRefresh={fetchDashboardData}
              />
            </div>
          </>
        )}
      </div>
    </SuiWalletProvider>
  );
}
