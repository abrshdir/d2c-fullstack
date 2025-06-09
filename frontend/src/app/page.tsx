"use client";

import { useState, useEffect } from "react";
import type { Token } from "@/lib/api/types";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { TokenSelection } from "@/components/TokenSelection";
import { PermitForm } from "@/components/PermitForm";
import { ActionCard } from "@/components/ActionCard";
import { StepIndicator } from "@/components/StepIndicator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Repeat,
  Lock,
  Download,
  TrendingUp,
  Award,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  useWallet,
  WalletProvider,
  ConnectButton,
  AllDefaultWallets,
  defineSlushWallet,
} from "@suiet/wallet-kit";
import { TokenScannerService } from "@/lib/api/tokenScanner";
import { ethers } from "ethers";

const STEPS = [
  {
    title: "Connect Wallet",
    description: "Connect your Ethereum wallet to start the staking process",
  },
  {
    title: "Select Token",
    description: "Choose the token you want to stake on SUI",
  },
  {
    title: "Sign Permit",
    description: "Approve the token transfer for staking",
  },
  {
    title: "Choose Action",
    description: "Decide whether to stake on SUI or withdraw USDC",
  },
  {
    title: "Manage Funds",
    description: "Monitor and manage your staked funds",
  },
];

// Add development mode flag at the top level
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isEthWalletConnected, setIsEthWalletConnected] = useState(false);
  const [ethWalletAddress, setEthWalletAddress] = useState<string | undefined>(
    undefined
  );
  const [ethSigner, setEthSigner] = useState<any>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [permitAmount, setPermitAmount] = useState<number | null>(null);
  const [permitSignature, setPermitSignature] = useState<{
    v: number;
    r: string;
    s: string;
  } | null>(null);
  const [usdcReceived, setUsdcReceived] = useState<number | null>(null);
  const [loanOwed, setLoanOwed] = useState<number | null>(null);
  const [collateralLocked, setCollateralLocked] = useState<boolean>(false);
  const [isStakingOnSui, setIsStakingOnSui] = useState<boolean>(false);

  const [stakeLoading, setStakeLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [ethConnectLoading, setEthConnectLoading] = useState(false);
  const { toast } = useToast();
  const suiWallet = useWallet();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleConnectEthWallet = async () => {
    setEthConnectLoading(true);
    if (typeof window.ethereum !== "undefined") {
      try {
        // Request account access
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

        if (accounts.length > 0) {
          // Set the wallet address
          setEthWalletAddress(accounts[0]);
          setIsEthWalletConnected(true);

          // Create an ethers provider and signer using v5 syntax
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          setEthSigner(signer);

          setCurrentStep(1); // Move to next step immediately
        } else {
          toast({
            title: "Metamask Connection Failed",
            description:
              "No accounts found. Please ensure your Metamask is set up.",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("Error connecting to Metamask:", error);
        toast({
          title: "Metamask Connection Error",
          description: error.message || "Could not connect to Metamask.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Metamask Not Found",
        description: "Please install Metamask to connect your Ethereum wallet.",
        variant: "destructive",
      });
    }
    setEthConnectLoading(false);
  };

  const handleTokenSelected = (token: Token) => {
    setSelectedToken(token);
    setCurrentStep(2);
  };

  const handlePermitSigned = (
    amount: number,
    signature: { v: number; r: string; s: string }
  ) => {
    setPermitAmount(amount);
    setPermitSignature(signature);
    setCurrentStep(3);
    toast({
      title: "Permit Signed",
      description: `Permit signed for ${amount} ${selectedToken?.symbol}.`,
    });
  };

  const handleSwapAndLock = async () => {
    if (!permitAmount || !permitSignature || !selectedToken || !ethSigner) {
      toast({
        title: "Error",
        description: "Missing permit data or signer. Please go back and sign the permit.",
        variant: "destructive",
      });
      return;
    }

    setStakeLoading(true);
    try {
      // Create a destination token (USDC) for the swap
      const usdcToken = {
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet address
        chainId: selectedToken.chainId,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        balance: "0",
        balanceFormatted: 0,
        usdValue: 1, // 1 USDC = $1
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Same as tokenAddress
        value: 0 // Initial value
      } as Token;

      // Get the permit data from the backend
      const permitData = {
        owner: ethWalletAddress || "",
        spender: "0x7fffBC1fc84F816353684EAc12E9a3344FFEAD29", // Our contract address
        value: permitAmount.toString(),
        nonce: 0, // This would come from the backend
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        chainId: Number(selectedToken.chainId), // Use the actual chain ID from the selected token
        name: selectedToken.name,
        symbol: selectedToken.symbol,
        tokenAddress: selectedToken.tokenAddress
      };

      let result;
      
      if (IS_DEVELOPMENT) {
        // Mock successful swap in development mode
        result = {
          status: 'SUCCESS',
          toAmount: (permitAmount * 0.95).toString(), // Mock 95% conversion rate
          error: null
        };
      } else {
        // Import the swap execution service
        const { swapExecutionService, TransactionStatus } = await import("@/lib/api/swapExecutionService");

        // Execute the swap
        result = await swapExecutionService.executeSwap(
          selectedToken,
          usdcToken,
          permitAmount,
          permitData,
          permitSignature,
          ethSigner
        );
      }

      if (result.status === 'SUCCESS') {
        // Parse the amounts from the result
        const usdcReceived = parseFloat(result.toAmount || "0");
        const gasCost = IS_DEVELOPMENT ? 0.1 : 0.5; // Lower gas cost in development mode

        setUsdcReceived(usdcReceived);
        setLoanOwed(usdcReceived + gasCost);
        setCollateralLocked(true);
        setCurrentStep(4);

        toast({
          title: "Swap & Lock Complete",
          description: `Received ${usdcReceived.toFixed(2)} USDC. Collateral locked.`,
        });
      } else {
        throw new Error(result.error || "Transaction failed");
      }
    } catch (error: any) {
      console.error("Error in swap and lock:", error);
      toast({
        title: "Swap & Lock Failed",
        description: error.message || "Could not complete the swap and lock operation.",
        variant: "destructive",
      });
    } finally {
      setStakeLoading(false);
    }
  };

  const handleWithdraw = async (withdrawAmount: number) => {
    setWithdrawLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const maxWithdrawable = (usdcReceived || 0) - (loanOwed || 0);
    if (withdrawAmount > maxWithdrawable) {
      toast({
        title: "Withdrawal Failed",
        description: "Amount exceeds available collateral minus loan.",
        variant: "destructive",
      });
    } else {
      setUsdcReceived((usdcReceived || 0) - withdrawAmount);
      toast({
        title: "Withdrawal Successful",
        description: `${withdrawAmount.toFixed(2)} USDC withdrawn.`,
      });
    }
    setWithdrawLoading(false);
  };

  const handleStakeOnSui = async () => {
    if (!suiWallet.connected) {
      toast({
        title: "Sui Wallet Not Connected",
        description: "Please connect your Sui wallet first to stake.",
        variant: "destructive",
      });
      // The SuiConnectButton should handle the connection flow if visible
      return;
    }
    setStakeLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsStakingOnSui(true);
    setLoanOwed((loanOwed || 0) * 0.95); // 5% discount
    setStakeLoading(false);
    toast({
      title: "Staking on SUI Activated",
      description: `Your loan has been adjusted with a discount. Connected with ${suiWallet.account?.address?.slice(
        0,
        6
      )}...`,
    });
  };

  const handleFinalizeRewards = async () => {
    setStakeLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    toast({
      title: "Rewards Finalized",
      description:
        "Staking rewards claimed, loan repaid, and surplus transferred.",
    });
    setLoanOwed(0);
    setUsdcReceived(0);
    setCollateralLocked(false);
    setIsStakingOnSui(false);
    setCurrentStep(0);
    setIsEthWalletConnected(false);
    setEthWalletAddress(undefined);
    setEthSigner(null);
    setSelectedToken(null);
    setPermitAmount(null);
    setPermitSignature(null);
    if (suiWallet.connected) {
      // Optionally disconnect Sui wallet or leave it connected for next session
      // suiWallet.disconnect();
    }
    setStakeLoading(false);
  };

  const resetProcess = () => {
    setCurrentStep(0);
    setIsEthWalletConnected(false);
    setEthWalletAddress(undefined);
    setEthSigner(null);
    setSelectedToken(null);
    setPermitAmount(null);
    setPermitSignature(null);
    setUsdcReceived(null);
    setLoanOwed(null);
    setCollateralLocked(false);
    setIsStakingOnSui(false);
    setStakeLoading(false);
    setWithdrawLoading(false);
    // Optionally disconnect wallets
    if (suiWallet.connected) {
      // suiWallet.disconnect().catch(console.error);
    }
    toast({
      title: "Process Reset",
      description: "You can start a new on-ramp transaction.",
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-muted-foreground">
                Start your SUI staking journey by connecting your Ethereum
                wallet. This allows you to bridge your tokens to the SUI
                network.
              </p>
            </div>
            <WalletConnectButton
              onConnect={handleConnectEthWallet}
              isConnected={isEthWalletConnected}
              walletAddress={ethWalletAddress}
              isLoading={ethConnectLoading}
            />
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Select Your Token</h2>
              <p className="text-muted-foreground">
                Choose the token you want to stake on SUI. Your selected token
                will be bridged to USDC and then staked on the SUI network.
              </p>
            </div>
            <TokenSelection
              onTokenSelect={handleTokenSelected}
              walletAddress={ethWalletAddress}
              selectedToken={selectedToken}
            />
          </div>
        );
      case 2:
        if (!selectedToken)
          return <p>Error: No token selected. Please go back.</p>;
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Sign Permit</h2>
              <p className="text-muted-foreground">
                Approve the token transfer by signing a permit. This allows the
                protocol to bridge your {selectedToken.symbol} to USDC for
                staking on SUI.
              </p>
            </div>
            <PermitForm
              token={selectedToken}
              signer={ethSigner}
              onPermitSign={handlePermitSigned}
              destinationToken={{
                chainId: selectedToken.chainId,
                tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet address
                symbol: "USDC",
                name: "USD Coin",
                decimals: 6,
                balance: "0",
                balanceFormatted: 0,
                usdValue: 1 // 1 USDC = $1
              }}
            />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Choose Your Action</h2>
              <p className="text-muted-foreground">
                You can either stake your tokens on SUI or withdraw the USDC
                directly.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                    Stake on SUI
                  </CardTitle>
                  <CardDescription>
                    Bridge your tokens to SUI network and earn staking rewards
                    with a 5% discount on gas fees.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleSwapAndLock}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    disabled={stakeLoading || withdrawLoading}
                  >
                    {stakeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Stake on SUI"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Download className="h-5 w-5 mr-2 text-blue-500" />
                    Withdraw USDC
                  </CardTitle>
                  <CardDescription>
                    Withdraw your USDC directly to your wallet, minus the gas
                    fees.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() =>
                      handleWithdraw(
                        Math.max(0, (usdcReceived || 0) - (loanOwed || 0))
                      )
                    }
                    className="w-full"
                    variant="outline"
                    disabled={stakeLoading || withdrawLoading}
                  >
                    {withdrawLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Withdraw USDC"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case 4:
        return (
          <Card className="w-full shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <CheckCircle2 className="h-7 w-7 text-green-500 mr-2" />
                SUI Staking Dashboard
              </CardTitle>
              <CardDescription>
                <div className="space-y-2">
                  <p>
                    Your tokens have been successfully bridged and are ready for
                    staking on SUI.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can now manage your staked funds, monitor rewards, and
                    withdraw when needed.
                  </p>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold">Staking Details:</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span>Original Token:</span>
                    <span className="font-medium">
                      {permitAmount} {selectedToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>USDC Received:</span>
                    <span className="font-medium">
                      ${usdcReceived?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Loan Owed:</span>
                    <span className="font-medium">
                      ${loanOwed?.toFixed(2)}
                      {isStakingOnSui && (
                        <span className="text-green-500 text-xs ml-2">
                          (5% discount applied)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Status:</span>
                    <span className="font-medium text-green-500">
                      {isStakingOnSui ? "Staking on SUI" : "Collateral Locked"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Actions:</h3>
                <div className="space-y-3">
                  {!isStakingOnSui && (
                    <div className="space-y-2">
                      <p className="text-sm">
                        Connect your SUI wallet to stake your tokens and earn a
                        5% discount on your loan.
                      </p>
                      <div className="flex items-center space-x-2">
                        <ConnectButton
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md"
                          onConnectSuccess={() => {
                            toast({
                              title: "SUI Wallet Connected",
                              description: `Connected to ${suiWallet.account?.address?.slice(
                                0,
                                6
                              )}...`,
                            });
                          }}
                        />
                        <Button
                          onClick={handleStakeOnSui}
                          className="flex-1"
                          disabled={
                            !suiWallet.connected ||
                            stakeLoading ||
                            isStakingOnSui
                          }
                        >
                          {stakeLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Stake Now"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isStakingOnSui && (
                    <div className="space-y-2">
                      <p className="text-sm">
                        Your tokens are now staking on SUI. You can finalize
                        rewards once they accrue.
                      </p>
                      <Button
                        onClick={handleFinalizeRewards}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={stakeLoading}
                      >
                        {stakeLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Finalize Rewards"
                        )}
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={resetProcess}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    <Repeat className="h-4 w-4 mr-2" />
                    Reset Process
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return <p>Unknown step</p>;
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">SUI Staking On-Ramp</h1>
        <p className="text-muted-foreground">
          Bridge your ERC-20 tokens to SUI and earn staking rewards
        </p>
      </div>

      <div className="mb-8">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={(step) => {
            // Only allow going back to previous steps
            if (step < currentStep) {
              setCurrentStep(step);
            }
          }}
        />
      </div>

      <div className="bg-card rounded-lg shadow-lg p-6">
        {renderStepContent()}
      </div>
    </div>
  );
}
