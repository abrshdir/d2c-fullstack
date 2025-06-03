"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import {
  SuiWalletProvider,
  SuiConnectButton,
} from "@/components/SuiWalletProvider"; // Assuming this handles SUI connection
import { useAccount } from "wagmi"; // For EVM wallet
// import { useWallet } from '@suiet/wallet-kit'; // For SUI wallet, if using Suiet
import { GasLoanForm } from "@/components/dashboard/GasLoanForm";
import { WithdrawForm } from "@/components/dashboard/WithdrawForm";
import { RepayLoanForm } from "@/components/dashboard/RepayLoanForm";
import { SuiStakingForm } from "@/components/dashboard/SuiStakingForm"; // Import SuiStakingForm
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { ActivityLog } from "@/components/dashboard/ActivityLog";

// Import API functions
import {
  getStakingStatus,
  getTransactionHistory, // Assuming this now accepts { page, limit }
  StakingStatus, // Import StakingStatus type
  TransactionHistory, // Import TransactionHistory type
} from "../../lib/api/api";

import { TokenScannerService, AccountStatusResponse } from "../../lib/api/tokenScanner"; // Import new service and type

// Mock data and types - replace with actual data fetching and types
// CollateralInfo interface removed
interface SwapHistoryItem {
  id: string;
  sourceToken: string;
  sourceChain: string;
  sourceAmount: string;
  usdcReceived: string;
  rubicRoute: string;
  gasCost: string;
  txHash: string;
}

interface StakingInfo {
  bridgedAmount: string;
  validatorName: string;
  startDate: string;
  expectedYield: string;
  rewardsInProgress: boolean;
  suiExplorerLink: string;
}

interface RewardsInfo {
  estimatedRewards: string;
  accruedBalance: string;
  repaymentAmount?: string;
  profitDistributed?: string;
  finalizedTxHash?: string;
}

// Mock API functions - replace with actual API calls
// fetchCollateralInfo mock function removed

const fetchSwapHistory = async (
  address: string
): Promise<SwapHistoryItem[]> => {
  console.log(`Fetching swap history for ${address}`);
  // Replace with: await fetch(`/api/user/${address}/history`)
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          {
            id: "1",
            sourceToken: "USDt",
            sourceChain: "Ethereum",
            sourceAmount: "10",
            usdcReceived: "9.5 USDC",
            rubicRoute: "USDt -> WETH -> USDC (Uniswap V2)",
            gasCost: "0.5 USDC",
            txHash: "0x123...abc",
          },
        ]),
      1000
    )
  );
};

const fetchStakingInfo = async (address: string): Promise<StakingInfo> => {
  console.log(`Fetching staking info for ${address}`);
  // Replace with: await fetch(`/api/user/${address}/staking`)
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          bridgedAmount: "90 USDC",
          validatorName: "SuiValidatorX",
          startDate: "2023-11-01",
          expectedYield: "5% APR",
          rewardsInProgress: true,
          suiExplorerLink: "https://suiexplorer.com/tx/0x456...def",
        }),
      1000
    )
  );
};

const fetchRewardsInfo = async (address: string): Promise<RewardsInfo> => {
  console.log(`Fetching rewards info for ${address}`);
  // Replace with API call
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          estimatedRewards: "12 USDC",
          accruedBalance: "8 USDC",
          // repaymentAmount: '10 USDC', // Example if finalized
          // profitDistributed: '2 USDC', // Example if finalized
        }),
      1000
    )
  );
};

export default function DashboardPage() {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  // const { address: suiAddress, connected: isSuiConnected } = useWallet(); // Example for Suiet
  const [suiAddress, setSuiAddress] = useState<string | null>(null); // Placeholder for SUI address
  const [isSuiConnected, setIsSuiConnected] = useState(false); // Placeholder
  const [stakingStatus, setStakingStatus] = useState<StakingStatus | null>(null); // Typed state
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory['transactions']>([]); // Typed state
  const [accountStatus, setAccountStatus] = useState<AccountStatusResponse | null>(null); // New state for account status
  const [isLoading, setIsLoading] = useState(false);

  const userAddress = evmAddress; // Dashboard primarily focuses on EVM account status for D2C Escrow

  useEffect(() => {
    const fetchData = async () => {
      if (!userAddress) {
        setAccountStatus(null); // Clear account status if EVM address is not available
        // Optionally clear other EVM-dependent states like transactionHistory if they are EVM specific
        // setTransactionHistory([]);
        // setStakingStatus(null); // If stakingStatus is purely EVM based for now
        return;
      }

      setIsLoading(true);
      try {
        // Fetch account status, staking status, and transaction history
        const promises = [
          TokenScannerService.getAccountStatus(userAddress),
          getStakingStatus('mockLoanId'), // Assuming 'mockLoanId' or similar, or make it conditional on userAddress
          getTransactionHistory(1, 10), // Assuming this is generic or EVM related
        ];

        const [accountStatusResult, stakingStatusResult, transactionHistoryResult] = await Promise.all(promises as [Promise<AccountStatusResponse>, Promise<StakingStatus>, Promise<TransactionHistory>]);

        setAccountStatus(accountStatusResult);
        setStakingStatus(stakingStatusResult);
        setTransactionHistory(transactionHistoryResult.transactions || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        // Set error states or show notifications to the user
        setAccountStatus(null); // Clear or set to an error state
        setStakingStatus(null);
        setTransactionHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userAddress]); // Dependency array includes userAddress

  // Placeholder for SUI wallet connection logic
  const handleSuiConnect = (addr: string | null) => {
    setSuiAddress(addr);
    setIsSuiConnected(!!addr);
  };

  if (!isEvmConnected && !isSuiConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
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
                onConnect={() => console.log("Attempting to connect EVM wallet...")}
                isConnected={isEvmConnected}
                walletAddress={evmAddress || undefined}
                // isLoading={isConnecting} // Add if you have a specific loading state for EVM connection
              />
            </div>
            <div>
              <h3 className="mb-2 font-semibold">SUI Wallet</h3>
              {/* Replace with actual SUI wallet connection from SuiWalletProvider */}
              <SuiWalletProvider onConnect={handleSuiConnect}>
                <SuiConnectButton />
              </SuiWalletProvider>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <SuiWalletProvider onConnect={handleSuiConnect}>
      {" "}
      {/* Ensure provider wraps content that might need SUI wallet */}
      <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">User Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back,{" "}
            {userAddress
              ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
              : "Guest"}
          </p>
        </header>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gas-loan">Request Gas Loan</TabsTrigger>
            <TabsTrigger value="repay-loan">Repay Loan</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw Funds</TabsTrigger>
            <TabsTrigger value="sui-stake">Stake on SUI</TabsTrigger> {/* New SUI Staking Tab */}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <DashboardMetrics accountStatus={accountStatus} stakingStatus={stakingStatus} />
            <ActivityLog activities={transactionHistory} />
          </TabsContent>

          <TabsContent value="gas-loan">
            <GasLoanForm /> {/* This is for requesting a new loan */}
          </TabsContent>

          <TabsContent value="repay-loan">
            <RepayLoanForm accountStatus={accountStatus} onRepaymentSuccess={fetchData} />
          </TabsContent>

          <TabsContent value="withdraw">
            <WithdrawForm accountStatus={accountStatus} onWithdrawalInitiated={fetchData} />
          </TabsContent>

          <TabsContent value="sui-stake"> {/* New SUI Staking Tab Content */}
            <SuiStakingForm accountStatus={accountStatus} onStakingSuccess={fetchData} />
          </TabsContent>
        </Tabs>

        {/* TODO: Add Notifications/Modals for edge cases */}
        {/* TODO: Add Power User Summary View */}
      </div>
    </SuiWalletProvider>
  );
}
