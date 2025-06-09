import { ethers } from "ethers";
import { Token } from "./types";
import { formatEther } from "ethers/lib/utils";

// API endpoints - all calls to 1inch should go through our backend
const BASE_URL = "http://localhost:3001/token-scanner/swap";

// Types for 1inch responses
interface QuoteResponse {
  toAmount: string;
  fromAmount: string;
  estimatedGas: string;
  protocols: any[];
}

interface SwapResponse {
  toAmount: string;
  fromAmount: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
}

interface ApproveResponse {
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
}

class OneInchService {
  /**
   * Get quote for swap
   * @param chainId - Chain ID
   * @param fromTokenAddress - Source token address
   * @param toTokenAddress - Destination token address
   * @param amount - Amount to swap in token decimals
   * @param token - Token object containing metadata
   * @param walletAddress - User's wallet address
   */
  async getQuote(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    token: Token,
    walletAddress: string
  ): Promise<QuoteResponse> {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(`${BASE_URL}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: {
            chainId: chainId.toString(),
            tokenAddress: fromTokenAddress,
            symbol: token.symbol,
            name: token.name,
            toTokenAddress,
            decimals: token.decimals,
            balance: amount,
            balanceFormatted: amount,
            usdValue: token.usdValue || 0,
            address: fromTokenAddress,
            value: parseFloat(amount),
          },
          walletAddress: walletAddress,
        }),
      });

      const data = await response.json();

      // Check for Rubic's "no routes found" error
      if (data.error && data.error.code === 2001) {
        throw new Error(
          "No swap routes found for this token. The token may be too illiquid or not supported."
        );
      }

      if (!response.ok) {
        throw new Error(data.error?.reason || "Failed to fetch quote");
      }

      return data;
    } catch (error: any) {
      console.error("Error getting quote:", error);
      // Re-throw the error with a user-friendly message
      throw new Error(
        error.message || "Failed to get swap quote. Please try again later."
      );
    }
  }

  /**
   * Get swap transaction data
   * @param chainId - Chain ID
   * @param fromTokenAddress - Source token address
   * @param toTokenAddress - Destination token address
   * @param amount - Amount to swap in token decimals
   * @param fromAddress - User's wallet address
   * @param token - Token object containing metadata
   * @param slippage - Slippage tolerance (e.g. 1 for 1%)
   */
  async getSwap(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    fromAddress: string,
    token: Token,
    slippage: number = 1
  ): Promise<SwapResponse> {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(
        `${BASE_URL}/swap?chainId=${chainId}&fromTokenAddress=${fromTokenAddress}` +
          `&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${fromAddress}&slippage=${slippage}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch swap transaction");
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting swap transaction:", error);
      // Fallback to a mock response if API call fails
      const quote = await this.getQuote(
        chainId,
        fromTokenAddress,
        toTokenAddress,
        amount,
        token,
        fromAddress
      );

      return {
        fromAmount: amount,
        toAmount: quote.toAmount,
        tx: {
          from: fromAddress,
          to: "0x1111111254fb6c44bAC0beD2854e76F90643097d", // 1inch router address
          data: "0x0000000000000000000000000000000000000000000000000000000000000000",
          value:
            fromTokenAddress === "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
              ? amount
              : "0",
          gasPrice: "0",
          gas: quote.estimatedGas,
        },
      };
    }
  }
}

export const oneInchService = new OneInchService();
