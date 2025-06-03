import { TokenScanResponse, ApiError } from "./types";

const API_BASE_URL = "http://localhost:3001";
const isDevelopment = process.env.NODE_ENV !== "development";

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

  static async scanWallet(walletAddress: string): Promise<TokenScanResponse> {
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
      const tokens = data.allTokens || data.ethereumTokens || [];

      // Filter out tokens with zero balance and format numbers
      const nonZeroTokens = tokens
        .filter((token) => token.balanceFormatted > 0)
        .map((token) => ({
          ...token,
          balanceFormatted: Number((token.balanceFormatted || 0).toFixed(5)),
          usdValue: Number((token.usdValue || 0).toFixed(5)),
        }));

      return {
        hasStrandedValue: Boolean(data.hasStrandedValue),
        topTokens: nonZeroTokens,
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
}
