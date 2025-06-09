import { TokenScanResponse, ApiError } from "./types";

const API_BASE_URL = "http://localhost:3001";
const isDevelopment = process.env.NODE_ENV !== "development";

// Cache configuration
const CACHE_DURATION = 100 * 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_KEY_PREFIX = 'token_scanner_cache_';

interface CacheEntry {
  data: TokenScanResponse;
  timestamp: number;
}

export class TokenScannerService {
  private static getCacheKey(walletAddress: string): string {
    return `${CACHE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
  }

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

  private static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < CACHE_DURATION;
  }

  static async scanWallet(walletAddress: string): Promise<TokenScanResponse> {
    if (!walletAddress) {
      throw new Error("Wallet address is required");
    }

    // Check cache first
    const cacheKey = this.getCacheKey(walletAddress);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const cachedEntry: CacheEntry = JSON.parse(cachedData);
        if (this.isCacheValid(cachedEntry.timestamp)) {
          console.log("Using cached token data for wallet:", walletAddress);
          return cachedEntry.data;
        }
      } catch (error) {
        console.error("Error parsing cached data:", error);
        // If there's an error parsing the cache, we'll proceed with a fresh fetch
      }
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
          tokenAddress: token.tokenAddress,
          chainId: token.chainId,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance,
          balanceFormatted: Number((token.balanceFormatted || 0).toFixed(5)),
          usdValue: Number((token.usdValue || 0).toFixed(5)),
          address: token.address || token.tokenAddress, // Use tokenAddress as fallback
          value: token.value || token.balanceFormatted, // Use balanceFormatted as fallback
        }));

      const processedData = {
        hasStrandedValue: Boolean(data.hasStrandedValue),
        topTokens: nonZeroTokens,
      };

      // Store in localStorage
      const cacheEntry: CacheEntry = {
        data: processedData,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));

      return processedData;
    } catch (error) {
      console.error("Error in scanWallet:", error);
      throw new Error(
        `Failed to scan wallet: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Method to clear cache for a specific wallet or all wallets
  static clearCache(walletAddress?: string) {
    if (walletAddress) {
      const cacheKey = this.getCacheKey(walletAddress);
      localStorage.removeItem(cacheKey);
    } else {
      // Clear all token scanner cache entries
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_KEY_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    }
  }
}
