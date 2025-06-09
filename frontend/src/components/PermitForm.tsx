import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, AlertTriangle, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Token } from "@/lib/api/types";
import { handleValidateAmount } from "@/lib/validateAmount";
import { PermitService } from "@/lib/api/permitService";
import { PermitData } from "@/lib/api/types";
import {
  swapExecutionService,
  TransactionStatus,
} from "@/lib/api/swapExecutionService";
import Image from "next/image";
import { formatEther, formatUnits, parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers/lib/ethers";

// Constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PermitFormProps {
  token: Token;
  signer: any; // ethers.js signer
  onPermitSign: (
    amount: number,
    signature: { v: number; r: string; s: string }
  ) => void;
  destinationToken?: Token; // Typically USDC
}

export function PermitForm({
  token,
  signer,
  onPermitSign,
  destinationToken,
}: PermitFormProps) {
  const [amount, setAmount] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [permitData, setPermitData] = useState<PermitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<{
    v: number;
    r: string;
    s: string;
  } | null>(null);
  const [gasEstimate, setGasEstimate] = useState<{
    gasEstimate: string;
    gasCostInEth: string;
    gasCostInUsd: string;
  } | null>(null);
  const [txStatus, setTxStatus] = useState<TransactionStatus | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { toast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [gasEstimateLoading, setGasEstimateLoading] = useState(false);
  const [gasEstimateTimer, setGasEstimateTimer] = useState(10);

  // Fetch permit data when component mounts
  useEffect(() => {
    const fetchPermitData = async () => {
      if (!token || !signer) return;

      try {
        const address = await signer.getAddress();
        
        // First check if token supports permits
        const response = await fetch(`${API_BASE_URL}/token-scanner/prepare-permit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: address,
            tokenAddress: token.tokenAddress,
            chainId: token.chainId,
          }),
        });

        const data = await response.json();
        
        if (data.message === "Token does not support EIP-2612 permit") {
          setError("This token does not support permit functionality. Please use a different token.");
          toast({
            title: "Token Not Supported",
            description: "This token does not support permit functionality. Please use a different token.",
            variant: "destructive",
          });
          return;
        }

        // Use the token data from localStorage/props instead of API response
        const permitData = await PermitService.preparePermit({
          walletAddress: address,
          tokenAddress: token.tokenAddress,
          chainId: token.chainId,
        });

        // Enhance the permit data with token information from our token object
        if (!permitData.owner || !permitData.spender || !permitData.value || 
            permitData.nonce === undefined || permitData.deadline === undefined || 
            permitData.chainId === undefined) {
          throw new Error('Invalid permit data: missing required fields');
        }

        const enhancedData: PermitData = {
          ...permitData,
          name: token.name,
          symbol: token.symbol,
          tokenAddress: token.tokenAddress,
          permitData: {
            owner: permitData.owner,
            spender: permitData.spender,
            value: permitData.value,
            nonce: permitData.nonce,
            deadline: permitData.deadline,
            chainId: permitData.chainId,
            name: token.name,
            symbol: token.symbol,
            tokenAddress: token.tokenAddress,
          }
        };

        setPermitData(enhancedData);
      } catch (err: any) {
        console.error("Error fetching permit data:", err);
        setError(err.message || "Failed to prepare permit data");
        toast({
          title: "Error",
          description: "Failed to prepare permit data. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchPermitData();
  }, [token, signer, toast]);

  // Validate amount with debounce
  useEffect(() => {
    if (!amount || amount === "") {
      setValidationError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const parsedAmount = parseFloat(amount);
        const result = await handleValidateAmount(parsedAmount, token);

        if (!result.valid) {
          setValidationError(result.message || "Invalid amount");
        } else {
          setValidationError(null);
        }
      } catch (error: any) {
        setValidationError(error.message || "Validation failed");
      } finally {
        setIsValidating(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, token]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  // Get gas estimates when amount changes and permit data is available
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    const getGasEstimate = async () => {
      if (!amount || isNaN(parseFloat(amount)) || !destinationToken || !signer || !permitData) {
        return;
      }

      try {
        setGasEstimateLoading(true);
        const userAddress = await signer.getAddress();
        const response = await fetch(`${API_BASE_URL}/token-scanner/estimate-gas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromToken: token,
            toToken: destinationToken,
            amount: parseFloat(amount),
            userAddress,
            permitData, // Include permit data in gas estimation
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get gas estimate');
        }

        const estimate = await response.json();
        setGasEstimate(estimate);
      } catch (err) {
        console.error("Error getting gas estimate:", err);
      } finally {
        setGasEstimateLoading(false);
      }
    };

    // Only start gas estimation if we have permit data
    if (permitData) {
      // Initial gas estimate
      const initialTimer = setTimeout(() => {
        getGasEstimate();
      }, 1000);

      // Set up the 10-second interval for gas estimates
      timerInterval = setInterval(() => {
        getGasEstimate();
      }, 10000);

      // Set up the countdown timer
      countdownInterval = setInterval(() => {
        setGasEstimateTimer((prev) => (prev > 0 ? prev - 1 : 10));
      }, 1000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(timerInterval);
        clearInterval(countdownInterval);
      };
    }
  }, [amount, token, destinationToken, signer, permitData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!permitData || !signer || validationError || !amount) {
      toast({
        title: "Cannot Sign Permit",
        description: validationError || "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      // Update the permit value based on the entered amount
      const parsedAmount = parseFloat(amount);
      const valueInWei = PermitService.calculateTokenAmount(
        parsedAmount,
        token.decimals
      );

      // Sign the permit
      const permitDataToSign: PermitData = {
        ...permitData,
        value: valueInWei,
        permitData: permitData.permitData ? {
          ...permitData.permitData,
          value: valueInWei,
        } : undefined
      };

      console.log('Permit Data to Sign:', permitDataToSign);

      const signature = await PermitService.signPermit(
        permitDataToSign,
        signer
      );

      if (signature) {
        setSignature(signature);
        onPermitSign(parsedAmount, signature);
        toast({
          title: "Permit Signed Successfully",
          description: `You've approved ${parsedAmount} ${token.symbol} for swapping.`,
        });

        // Send permit signature to backend for swap execution
        const response = await fetch(`${API_BASE_URL}/token-scanner/execute-swap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permitData: permitDataToSign,
            signature,
            amount: parsedAmount,
            fromToken: token,
            toToken: destinationToken,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to execute swap');
        }

        const result = await response.json();
        
        if (result.status === 'success') {
          setTxStatus(TransactionStatus.PENDING);
          setTxHash(result.txHash);
          toast({
            title: "Swap Initiated",
            description: "Your tokens are being swapped and will be held in escrow.",
          });
        } else {
          throw new Error(result.error || 'Swap failed');
        }
      }
    } catch (err: any) {
      console.error("Error signing permit:", err);
      setError(err.message || "Failed to sign permit");
      toast({
        title: "Signing Failed",
        description: err.message || "Failed to sign the permit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

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
  const tokenIconUrl = `https://raw.githubusercontent.com/trustwallet/assets/refs/heads/master/blockchains/${chainName}/assets/${token.tokenAddress.toLowerCase()}/logo.png`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-center mb-6">
        <div className="bg-primary/10 p-3 rounded-full">
          {imgError ? (
            <Coins className="w-16 h-16 text-muted-foreground" />
          ) : (
            <Image
              src={tokenIconUrl}
              alt={token.symbol}
              width={64}
              height={64}
              className="rounded-full"
              onError={() => setImgError(true)}
              unoptimized // Add this to bypass Next.js image optimization for external URLs
            />
          )}
        </div>
      </div>

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold">{token.name}</h3>
        <p className="text-muted-foreground">
          Current Balance: {token.balanceFormatted} {token.symbol}
        </p>
        {/* Change this */}
        <p className="text-muted-foreground">
          Value: $
          {(parseFloat(token.balanceFormatted.toString()) * 1).toFixed(2)}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount to Stake</Label>
        <div className="relative">
          <Input
            id="amount"
            type="text"
            placeholder={`Enter amount (max: ${token.balanceFormatted})`}
            value={amount}
            onChange={handleAmountChange}
            className={validationError ? "border-red-500" : ""}
            disabled={isSigning}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setAmount(token.balanceFormatted.toString())}
              disabled={isSigning}
            >
              Max
            </button>
          </div>
        </div>
        {validationError && (
          <p className="text-sm text-red-500">{validationError}</p>
        )}
        {isValidating && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Validating...
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">
            {error.includes('no matching fragment (operation="fragment", info={ "args"') ? 
              'Error: The swap execution failed due to an incompatible contract interface. Please contact support.' : 
              error}
          </p>
        </div>
      )}

      {/* Gas Estimate Display */}
      {gasEstimate && !validationError && !isValidating && amount && (
        <div className="p-3 bg-transparent border border-blue-200 rounded-md mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">Estimated Gas:</p>
            <div className="flex items-center space-x-2">
              {gasEstimateLoading && (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              )}
              <p className="text-xs text-muted-foreground">
                Updates in {gasEstimateTimer}s
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              Gas Units: {Number(gasEstimate.gasEstimate).toLocaleString()}
            </p>
            <p className="text-sm">
              Cost: {formatEther(BigNumber.from(Math.floor(Number(gasEstimate.gasCostInEth)).toString()))} ETH
            </p>
            <p className="text-sm text-muted-foreground">
              ≈ {formatEther(BigNumber.from(Math.floor(Number(gasEstimate.gasCostInUsd)).toString()))}
            </p>
          </div>
        </div>
      )}

      {/* Transaction Status */}
      {txStatus && (
        <div
          className={`p-3 rounded-md mb-4 ${
            txStatus === TransactionStatus.SUCCESS
              ? "bg-green-50 border border-green-200"
              : txStatus === TransactionStatus.FAILED
              ? "bg-red-50 border border-red-200"
              : "bg-blue-50 border border-blue-200"
          }`}
        >
          <div className="flex items-center">
            {txStatus === TransactionStatus.SUCCESS ? (
              <Check className="h-4 w-4 text-green-500 mr-2" />
            ) : txStatus === TransactionStatus.FAILED ? (
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />
            )}
            <p className="text-sm font-medium">
              {txStatus === TransactionStatus.SUCCESS
                ? "Transaction Successful"
                : txStatus === TransactionStatus.FAILED
                ? "Transaction Failed"
                : txStatus === TransactionStatus.PENDING
                ? "Transaction Pending"
                : "Processing Transaction"}
            </p>
          </div>
          {txHash && (
            <p className="text-xs mt-1">
              Tx Hash:{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline truncate block"
              >
                {txHash}
              </a>
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          !!validationError ||
          isValidating ||
          isSigning ||
          isSwapping ||
          !amount ||
          !permitData ||
          !gasEstimate ||
          gasEstimateLoading ||
          txStatus === TransactionStatus.SUCCESS
        }
      >
        {isSwapping ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Executing Swap...
          </>
        ) : isSigning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Signing Permit...
          </>
        ) : signature ? (
          <>Execute Swap</>
        ) : gasEstimateLoading ? (
          <>Loading Gas Estimate...</>
        ) : (
          <>Sign Permit</>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By signing, you authorize our protocol to swap your tokens and deposit
        the result in the escrow contract. Gas will be required for the swap
        transaction.
      </p>
    </form>
  );
}

