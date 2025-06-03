import { TokenScanResponse, ApiError, Token, SuiStakingRequest, SuiStakingResult } from "./types"; // Use Token, add SuiStaking types

const API_BASE_URL = "http://localhost:3001"; // Assuming this will be configured via ENV vars in a real app
const isDevelopment = process.env.NODE_ENV === "development";

// Interface for the /account-status endpoint response
export interface AccountStatusResponse {
  escrowedAmount: string;
  outstandingDebt: string;
  reputationScore: number;
  isBlacklisted: boolean;
  // Optional legacy fields, if backend provides them for compatibility
  collateralAmount?: string;
  loanOwed?: string;
}

// Removed local UpdatedTokenScanResponse interface

export class TokenScannerService {
  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(`API Error: ${error.message} (${error.statusCode})`);
    }
    const data = await response.json();
    if (!data) {
      throw new Error("No data received from the server");
    }
    return data;
  }

  static async scanWallet(walletAddress: string): Promise<TokenScanResponse> { // Returns TokenScanResponse from types.ts
    if (!walletAddress) {
      throw new Error("Wallet address is required");
    }

    try {
      // Use test endpoint in development, main endpoint in production
      const endpoint = isDevelopment ? "scan-test" : "scan";
      const response = await fetch(
        `${API_BASE_URL}/token-scanner/${endpoint}?walletAddress=${encodeURIComponent(
          walletAddress
        )}`
      );
      const data = await this.handleResponse<TokenScanResponse>(response);

      // Validate the response structure
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format from server");
      }

      // Use allTokens if available, otherwise fallback to ethereumTokens
      const tokens: Token[] = data.allTokens || data.ethereumTokens || data.sepoliaTokens || [];

      // Filter out tokens with zero balance and format numbers
      const nonZeroTokens: Token[] = tokens
        .filter((token) => token.balanceFormatted > 0)
        .map((token) => ({
          ...token,
          balanceFormatted: Number(parseFloat(String(token.balanceFormatted || 0)).toFixed(5)),
          usdValue: Number(parseFloat(String(token.usdValue || 0)).toFixed(5)),
        }));

      // The backend's scan endpoint now returns outstandingDebt directly
      // The TokenScanResponse type from types.ts already includes these fields as optional
      return {
        allTokens: data.allTokens,
        ethereumTokens: data.ethereumTokens,
        sepoliaTokens: data.sepoliaTokens,
        hasStrandedValue: Boolean(data.hasStrandedValue),
        gasSponsoredSwapAvailable: data.gasSponsoredSwapAvailable,
        outstandingDebt: data.outstandingDebt,
        topTokens: nonZeroTokens, // This is the frontend-specific transformation
      };
    } catch (error) {
      console.error("Error in scanWallet:", error);
      throw new Error(
        `Failed to scan wallet: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static async getAccountStatus(walletAddress: string): Promise<AccountStatusResponse> {
    if (!walletAddress) {
      throw new Error("Wallet address is required for fetching account status.");
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/token-scanner/account-status?walletAddress=${encodeURIComponent(
          walletAddress
        )}`
      );
      // Assuming handleResponse is generic enough or create a new one if validation differs
      const data = await this.handleResponse<AccountStatusResponse>(response);

      if (!data || typeof data !== "object") {
        throw new Error("Invalid account status response format from server");
      }

      // Potentially format numbers here if needed, e.g., strings to numbers
      // For now, assume backend sends them in the correct string/number format per DTO.
      return data;
    } catch (error) {
      console.error("Error in getAccountStatus:", error);
      throw new Error(
        `Failed to fetch account status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static async initiateSuiStaking(request: SuiStakingRequest): Promise<SuiStakingResult> {
    if (!request.userAddress || !request.usdcAmountToStake || !request.chainId) {
      throw new Error("User address, amount to stake, and chain ID are required for SUI staking.");
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/token-scanner/stake-on-sui`, // Matches backend controller
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }
      );
      return this.handleResponse<SuiStakingResult>(response);
    } catch (error) {
      console.error("Error in initiateSuiStaking:", error);
      throw new Error(
        `Failed to initiate SUI staking: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
