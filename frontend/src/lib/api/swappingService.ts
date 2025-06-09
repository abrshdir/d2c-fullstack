import { ethers } from "ethers";
import { Token } from "./types";

// API endpoints - all calls to 1inch should go through our backend
const BASE_URL = "http://localhost:3001/token-scanner/swap";

interface QuoteResponse {
  toAmount: string;
  fromAmount: string;
  estimatedGas: string;
  protocols: any[];
}

class SwappingService {
  /**
   * Get quote for swap - MOCK implementation
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
}

export const swappingService = new SwappingService();
