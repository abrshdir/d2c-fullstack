import { ethers } from "ethers";
import type { Signer } from "ethers";
import { oneInchService } from "./apiService";
import { permitVerificationService } from "./permitVerificationService";
import { PermitData, Token } from "./types";
import { getContractInstance } from "../contracts/contractUtils";
import { formatUnits, parseUnits } from "ethers/lib/utils";

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
    signer: Signer
  ): Promise<SwapResult> {
    try {
      const result: SwapResult = {
        status: TransactionStatus.PROCESSING,
      };

      const amountInWei = parseUnits(amount.toString(), fromToken.decimals);

      const userAddress = await signer.getAddress();
      console.log(`Executing swap for ${userAddress}`);

      try {
        const quote = await oneInchService.getQuote(
          Number(fromToken.chainId),
          fromToken.tokenAddress,
          toToken.tokenAddress,
          amountInWei.toString(),
          fromToken,
          userAddress
        );

        const swapData = await oneInchService.getSwap(
          Number(fromToken.chainId),
          fromToken.tokenAddress,
          toToken.tokenAddress,
          amountInWei.toString(),
          userAddress
        );

        // Execute the swap transaction
        const tx = await signer.sendTransaction({
          to: swapData.tx.to,
          data: swapData.tx.data,
          value: swapData.tx.value,
          gasLimit: swapData.tx.gas,
        });

        result.txHash = tx.hash;
        result.status = TransactionStatus.PENDING;

        // Wait for transaction confirmation
        const receipt = await tx.wait();

        if (receipt.status === 1) {
          result.status = TransactionStatus.SUCCESS;
          result.fromAmount = amount.toString();
          result.toAmount = formatUnits(swapData.toAmount, toToken.decimals);
          result.gasUsed = receipt.gasUsed.toString();
          console.log(`Transaction successful: ${tx.hash}`);
        } else {
          result.status = TransactionStatus.FAILED;
          result.error = "Transaction failed";
          console.log(`Transaction failed: ${tx.hash}`);
        }
      } catch (quoteError: any) {
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
   * Get gas estimate for the swap + deposit process
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
      const amountInWei = parseUnits(
        amount.toString(),
        fromToken.decimals
      ).toString();

      const quote = await oneInchService.getQuote(
        Number(fromToken.chainId),
        fromToken.tokenAddress,
        toToken.tokenAddress,
        amountInWei,
        fromToken,
        userAddress
      );

      // Get ETH price from a price feed service
      const ethPrice = 1800; // TODO: Replace with actual price feed service
      const gasCostInUsd = (parseFloat(quote.estimatedGas) * ethPrice).toFixed(
        2
      );

      console.log(
        `Gas estimate for ${userAddress}: ${JSON.stringify(
          quote.estimatedGas
        )} gas units`
      );

      return {
        gasEstimate: (quote.estimatedGas as any).gasEstimate,
        gasCostInEth: (quote.estimatedGas as any).gasCostInEth, // Using the router's gas estimate
        gasCostInUsd: (quote.estimatedGas as any).gasCostInUsd, // Fallback to calculated USD cost
      };
    } catch (error: any) {
      console.error("Error estimating gas:", error);
      throw new Error(`Failed to estimate gas: ${error.message}`);
    }
  }

  /**
   * Lock collateral in the escrow contract
   * @param token - Token to lock
   * @param amount - Amount to lock
   * @param permitData - Permit data
   * @param signature - Permit signature
   * @param signer - Ethers signer
   */
  async lockCollateral(
    token: Token,
    amount: number,
    permitData: PermitData,
    signature: { v: number; r: string; s: string },
    signer: Signer
  ): Promise<{ success: boolean; txHash?: string }> {
    try {
      const contract = await getContractInstance(signer.provider!);

      const amountInWei = parseUnits(
        amount.toString(),
        token.decimals
      ).toString();

      const tx = await contract.lockCollateral(
        token.tokenAddress,
        amountInWei,
        permitData,
        signature
      );

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
      };
    } catch (error: any) {
      console.error("Error locking collateral:", error);
      return {
        success: false,
      };
    }
  }
}

export const swapExecutionService = new SwapExecutionService();
