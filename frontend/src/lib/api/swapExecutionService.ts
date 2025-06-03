import { ethers } from "ethers";
import { oneInchService } from "./oneInchService";
import { permitVerificationService } from "./permitVerificationService";
import { PermitData, Token } from "./types";
import {
  getContractInstance,
  getCurrentGasPrice,
} from "../contracts/contractUtils";

// Extended PermitData interface to include message property
interface ExtendedPermitData extends PermitData {
  message: {
    owner: string;
    spender: string;
    value: string;
    nonce: number;
    deadline: number;
  };
}

// Transaction status enum
export enum TransactionStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SUCCESS = "success",
  FAILED = "failed",
}

// Swap result interface
export interface SwapResult {
  status: TransactionStatus;
  txHash?: string;
  error?: string;
  fromAmount?: string;
  toAmount?: string;
  gasUsed?: string;
}

class SwapExecutionService {
  /**
   * Execute a complete swap flow after permit signing
   * @param fromToken - Source token
   * @param toToken - Destination token (typically USDC)
   * @param amount - Amount to swap
   * @param permitData - Permit data
   * @param signature - Permit signature
   * @param signer - Ethers signer
   */
  async executeSwap(
    fromToken: Token,
    toToken: Token,
    amount: number,
    permitData: PermitData,
    signature: { v: number; r: string; s: string },
    signer: any // Using any type to bypass ethers version conflicts
  ): Promise<SwapResult> {
    try {
      // Update status to indicate processing
      const result: SwapResult = {
        status: TransactionStatus.PROCESSING,
      };

      // Simulate network delay for transaction preparation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 1. Get swap quote from 1inch
      const amountInWei = ethers.parseUnits(
        amount.toString(),
        fromToken.decimals
      );

      // Get user address first
      const userAddress = await signer.getAddress();
      console.log(`Simulating swap for ${userAddress}`);

      try {
        const quote = await oneInchService.getQuote(
          Number(fromToken.chainId),
          fromToken.tokenAddress,
          toToken.tokenAddress,
          amountInWei.toString(),
          fromToken,
          userAddress
        );

        // 2. Get swap data
        const swapData = await oneInchService.getSwap(
          Number(fromToken.chainId),
          fromToken.tokenAddress,
          toToken.tokenAddress,
          amountInWei.toString(),
          userAddress
        );

        // Generate a mock transaction hash
        const mockTxHash = `0x${Math.random().toString(16).substr(2, 40)}`;
        result.txHash = mockTxHash;
        result.status = TransactionStatus.PENDING;

        // Simulate transaction confirmation delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 90% chance of success (for testing both success and failure)
        const isSuccessful = Math.random() < 0.9;

        if (isSuccessful) {
          // Simulate successful transaction
          result.status = TransactionStatus.SUCCESS;
          result.fromAmount = amount.toString();
          result.toAmount = ethers.formatUnits(swapData.toAmount, toToken.decimals);
          result.gasUsed = "150000";

          console.log(`Mock transaction successful: ${mockTxHash}`);
        } else {
          // Simulate failed transaction
          result.status = TransactionStatus.FAILED;
          result.error = "Transaction failed: insufficient funds or high slippage";
          console.log(`Mock transaction failed: ${mockTxHash}`);
        }
      } catch (quoteError) {
        // Handle quote errors specifically
        result.status = TransactionStatus.FAILED;
        result.error = quoteError.message;
        console.log(`Quote error: ${quoteError.message}`);
      }

      return result;
    } catch (error: any) {
      console.error("Error executing swap:", error);
      return {
        status: TransactionStatus.FAILED,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Get gas estimate for the swap + deposit process - MOCK IMPLEMENTATION
   * @param fromToken - Source token
   * @param toToken - Destination token
   * @param amount - Amount to swap
   * @param userAddress - User's wallet address
   */
  async estimateGasForSwap(
    fromToken: Token,
    toToken: Token,
    amount: number,
    userAddress: string
  ): Promise<{
    gasEstimate: string;
    gasCostInEth: string;
    gasCostInUsd: string;
  }> {
    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Calculate amount in wei (for consistency)
      const amountInWei = ethers
        .parseUnits(amount.toString(), fromToken.decimals)
        .toString();

      try {
        // Get quote for gas estimate with complete token information
        const quote = await oneInchService.getQuote(
          Number(fromToken.chainId),
          fromToken.tokenAddress,
          toToken.tokenAddress,
          amountInWei,
          fromToken,
          userAddress
        );

        // Mock gas price (50 Gwei)
        const gasPrice = "50000000000";

        // Calculate gas cost
        const gasCost = oneInchService.calculateGasCost(
          quote.estimatedGas,
          gasPrice
        );

        // Use fixed ETH price of $1800 for demonstration
        const ethPrice = 1800;
        const gasCostInUsd = parseFloat(gasCost) * ethPrice;

        console.log(
          `Gas estimate mock for ${userAddress}: ${quote.estimatedGas} gas units`
        );

        return {
          gasEstimate: quote.estimatedGas,
          gasCostInEth: gasCost,
          gasCostInUsd: gasCostInUsd.toFixed(2),
        };
      } catch (quoteError) {
        // If we can't get a quote, return a default gas estimate
        console.warn(`Could not get quote for gas estimate: ${quoteError.message}`);
        return {
          gasEstimate: "150000", // Default gas estimate
          gasCostInEth: "0.0075", // Default gas cost in ETH
          gasCostInUsd: "13.50", // Default gas cost in USD
        };
      }
    } catch (error) {
      console.error("Error estimating gas:", error);
      throw error;
    }
  }
}

export const swapExecutionService = new SwapExecutionService();
