import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Token } from "@/lib/api/types";
import { handleValidateAmount } from "@/lib/validateAmount";
import { PermitService } from "@/lib/api/permitService";
import { PermitData } from "@/lib/api/types";
import {
  swapExecutionService,
  TransactionStatus,
} from "@/lib/api/swapExecutionService";

interface PermitFormProps {
  token: Token;
  signer: any; // ethers.js signer
  onPermitSign: (
    amount: number,
    signature: { v: number; r: string; s: string }
  ) => void;
  destinationToken?: Token; // Typically USDC
}

// Add development mode flag
const IS_DEVELOPMENT = process.env.NODE_ENV !== "development";

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

  // Fetch permit data when component mounts
  useEffect(() => {
    const fetchPermitData = async () => {
      if (!token || !signer) return;

      try {
        const address = await signer.getAddress();
        const data = await PermitService.preparePermit({
          walletAddress: address,
          tokenAddress: token.tokenAddress,
          chainId: token.chainId,
        });

        // Enhance the permit data with token information
        const enhancedData: PermitData = {
          ...data,
          name: token.name,
          symbol: token.symbol,
          tokenAddress: token.tokenAddress,
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

  // Get gas estimates when amount changes
  useEffect(() => {
    const getGasEstimate = async () => {
      if (
        !amount ||
        isNaN(parseFloat(amount)) ||
        !destinationToken ||
        !signer
      ) {
        return;
      }

      try {
        const userAddress = await signer.getAddress();
        const estimate = await swapExecutionService.estimateGasForSwap(
          token,
          destinationToken,
          parseFloat(amount),
          userAddress
        );

        setGasEstimate(estimate);
      } catch (err) {
        console.error("Error getting gas estimate:", err);
        // Don't set error here to avoid UI disruption
      }
    };

    // Debounce gas estimation
    const timer = setTimeout(() => {
      getGasEstimate();
    }, 1000);

    return () => clearTimeout(timer);
  }, [amount, token, destinationToken, signer]);

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

      if (IS_DEVELOPMENT) {
        // Mock signature in development mode
        const mockSignature = {
          v: 27,
          r: "0x".padEnd(66, "0"),
          s: "0x".padEnd(66, "0"),
        };
        setSignature(mockSignature);
        onPermitSign(parsedAmount, mockSignature);
        toast({
          title: "Permit Signed!",
          description: `Permit for ${parsedAmount} ${token.symbol}.`,
        });
        setIsSigning(false);
        return;
      }

      // Sign the permit
      const permitDataToSign: PermitData = {
        ...permitData,
        value: valueInWei,
      };

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

        // If we have a destination token, we can proceed with the swap
        if (destinationToken) {
          await executeSwap(parsedAmount, signature);
        }
      }
    } catch (err: any) {
      console.error("Error signing permit:", err);
      setError(err.message || "Failed to sign permit");
      toast({
        title: "Signing Failed",
        description:
          err.message || "Failed to sign the permit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const executeSwap = async (
    parsedAmount: number,
    signature: { v: number; r: string; s: string }
  ) => {
    if (!destinationToken || !permitData) return;

    setIsSwapping(true);
    setTxStatus(TransactionStatus.PROCESSING);

    try {
      // Execute the swap with 1inch and deposit to contract
      const result = await swapExecutionService.executeSwap(
        token,
        destinationToken,
        parsedAmount,
        permitData,
        signature,
        signer
      );

      setTxStatus(result.status);

      if (result.txHash) {
        setTxHash(result.txHash);
      }

      if (result.status === TransactionStatus.SUCCESS) {
        toast({
          title: "Swap Successful",
          description: `Swapped ${result.fromAmount} ${token.symbol} for ${result.toAmount} ${destinationToken.symbol}`,
        });
      } else if (result.status === TransactionStatus.FAILED) {
        setError(result.error || "Swap failed for unknown reason");
        toast({
          title: "Swap Failed",
          description: result.error || "An error occurred during the swap",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error executing swap:", err);
      setError(err.message || "Failed to execute swap");
      setTxStatus(TransactionStatus.FAILED);
      toast({
        title: "Swap Execution Failed",
        description:
          err.message || "Failed to execute the swap. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-center mb-6">
        <div className="bg-primary/10 p-3 rounded-full">
          <img
            src={`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png`}
            alt={token.symbol}
            className="w-16 h-16 rounded-full"
            onError={(e) => {
              // Fallback to a generic token icon if the image fails to load
              (e.target as HTMLImageElement).src = "/token-placeholder.png";
            }}
          />
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
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Gas Estimate Display */}
      {gasEstimate && !validationError && !isValidating && amount && (
        <div className="p-3 bg-transparent border border-blue-200 rounded-md mb-4">
          <p className="text-sm font-medium">Estimated Gas:</p>
          <p className="text-sm">
            0.00043 ETH $1.21
            {/* {gasEstimate.gasCostInEth} ETH (≈ ${gasEstimate.gasCostInUsd}) */}
          </p>
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
