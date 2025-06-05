import { ethers } from 'ethers';
import { Token } from './types';

// API endpoints - all calls to 1inch should go through our backend
const BASE_URL = 'http://localhost:3001/token-scanner/swap';

// Types for 1inch responses
interface GasPriceResponse {
  baseFee: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

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
   * Get current gas prices from 1inch API
   * @param chainId - Chain ID (e.g. 1 for Ethereum mainnet)
   */
  async getGasPrice(chainId: number = 1): Promise<GasPriceResponse> {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(`/oneinch/gas-price?chainId=${chainId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch gas price');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching gas price:', error);
      // Return fallback values if API call fails
      return {
        baseFee: '20000000000', // 20 Gwei
        maxFeePerGas: '50000000000', // 50 Gwei
        maxPriorityFeePerGas: '2000000000' // 2 Gwei
      };
    }
  }
  /**
   * Get supported chains from 1inch
   */
  async getSupportedChains() {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(`${BASE_URL}/chains`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch supported chains');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching supported chains:', error);
      // Return fallback values if API call fails
      return {
        1: 'Ethereum',
        137: 'Polygon',
        56: 'BSC',
        42161: 'Arbitrum',
        10: 'Optimism'
      };
    }
  }

  /**
   * Get token list from 1inch
   * @param chainId - Chain ID (e.g. 1 for Ethereum mainnet)
   */
  async getTokens(chainId: number) {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(`${BASE_URL}/tokens?chainId=${chainId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Return fallback values if API call fails
      return {
        '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE': {
          symbol: 'ETH',
          name: 'Ethereum',
          address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          decimals: 18,
          logoURI: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
        },
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
          symbol: 'USDC',
          name: 'USD Coin',
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          decimals: 6,
          logoURI: 'https://tokens.1inch.io/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png'
        }
      };
    }
  }

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
      const response = await fetch(
        `${BASE_URL}/quote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
              value: parseFloat(amount)
            },
            walletAddress: walletAddress
          })
        }
      );
      
      const data = await response.json();
      
      // Check for Rubic's "no routes found" error
      if (data.error && data.error.code === 2001) {
        throw new Error('No swap routes found for this token. The token may be too illiquid or not supported.');
      }
      
      if (!response.ok) {
        throw new Error(data.error?.reason || 'Failed to fetch quote');
      }
      
      return data;
    } catch (error: any) {
      console.error('Error getting quote:', error);
      // Re-throw the error with a user-friendly message
      throw new Error(error.message || 'Failed to get swap quote. Please try again later.');
    }
  }

  /**
   * Get approval transaction for 1inch - MOCK implementation
   * @param chainId - Chain ID
   * @param tokenAddress - Token address to approve
   * @param amount - Amount to approve (use ethers.constants.MaxUint256 for unlimited)
   */
  async getApproveTransaction(
    chainId: number,
    tokenAddress: string,
    amount: string = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' // MaxUint256
  ): Promise<ApproveResponse> {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(
        `${BASE_URL}/approve?chainId=${chainId}&tokenAddress=${tokenAddress}&amount=${amount}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch approval transaction');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting approval transaction:', error);
      // Fallback to a mock response if API call fails
      const gasPriceData = await this.getGasPrice(chainId);
      
      return {
        tx: {
          from: "0x0000000000000000000000000000000000000000", // Will be filled by the caller
          to: tokenAddress,
          data: "0x095ea7b3000000000000000000000000def1c0ded9bec7f1a1670819833240f027b25eff000000000000000000000000000000000000000000000000ffffffffffffffff",
          value: "0",
          gasPrice: gasPriceData.maxFeePerGas,
          gas: "55000"
        }
      };
    }
  }

  /**
   * Get swap transaction data
   * @param chainId - Chain ID
   * @param fromTokenAddress - Source token address
   * @param toTokenAddress - Destination token address
   * @param amount - Amount to swap in token decimals
   * @param fromAddress - User's wallet address
   * @param slippage - Slippage tolerance (e.g. 1 for 1%)
   */
  async getSwap(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    fromAddress: string,
    slippage: number = 1
  ): Promise<SwapResponse> {
    try {
      // Call our backend API that communicates with 1inch
      const response = await fetch(
        `${BASE_URL}/swap?chainId=${chainId}&fromTokenAddress=${fromTokenAddress}` +
        `&toTokenAddress=${toTokenAddress}&amount=${amount}&fromAddress=${fromAddress}&slippage=${slippage}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch swap transaction');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      // Fallback to a mock response if API call fails
      const quote = await this.getQuote(chainId, fromTokenAddress, toTokenAddress, amount, token, fromAddress);
      const gasPriceData = await this.getGasPrice(chainId);
      const gasPrice = gasPriceData.maxFeePerGas;
      
      return {
        fromAmount: amount,
        toAmount: quote.toAmount,
        tx: {
          from: fromAddress,
          to: '0x1111111254fb6c44bAC0beD2854e76F90643097d', // 1inch router address
          data: '0x0000000000000000000000000000000000000000000000000000000000000000',
          value: fromTokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ? amount : '0',
          gasPrice: gasPrice,
          gas: quote.estimatedGas
        }
      };
    }
  }

  /**
   * Calculate gas cost for a transaction
   * @param gasEstimate - Estimated gas
   * @param gasPrice - Current gas price in wei
   */
  calculateGasCost(gasEstimate: string, gasPrice: string): string {
    const gasBigNumber = ethers.parseUnits(gasEstimate, 0); // Convert to BigInt
    const gasPriceBigNumber = ethers.parseUnits(gasPrice, 0);
    const gasCost = gasBigNumber * gasPriceBigNumber; // BigInt multiplication
    return ethers.formatEther(gasCost);
  }
}

export const oneInchService = new OneInchService();
