import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ethers } from 'ethers';
import { firstValueFrom } from 'rxjs';
import { TokenWithValue } from './token-scanner.service';

/**
 * Response from the Rubic API for a swap quote
 */
export interface SwapQuote {
  id: string;
  fromToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    blockchain: string;
    balance: string;
    usdValue: number;
  };
  toToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    blockchain: string;
    balance: string;
    usdValue: number;
  };
  toTokenAmount: string;
  fromTokenAmount: string;
  protocols: string[];
  estimatedGas: string;
}

/**
 * Response from the Rubic API for a swap transaction
 */
export interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
}

/**
 * Response from the Rubic API for a swap status
 */
export interface SwapStatus {
  status: string;
  destinationTxHash?: string;
}

/**
 * Result of executing a swap
 */
export interface SwapResult {
  transactionHash: string;
  usdcObtained: string;
  gasCost: string;
  timestamp: number;
}

/**
 * Rubic API request for a quote
 */
interface QuoteRequestDto {
  srcTokenAddress: string;
  srcTokenAmount: string;
  srcTokenBlockchain: string;
  dstTokenAddress: string;
  dstTokenBlockchain: string;
  fromAddress: string;
  receiver: string;
  slippage: number;
  referrer?: string;
}

/**
 * Rubic API response for a quote
 */
interface QuoteResponseDto {
  id: string;
  provider: string;
  estimate: {
    destinationTokenAmount: string;
    destinationTokenMinAmount: string;
    priceImpact: number;
    estimatedGas?: string;
  };
}

/**
 * Rubic API request for a swap
 */
interface SwapRequestDto extends QuoteRequestDto {
  id: string;
}

/**
 * Rubic API response for a swap
 */
interface SwapResponseDto {
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
  };
}

@Injectable()
export class RubicSwapService {
  private readonly logger = new Logger(RubicSwapService.name);
  private readonly rubicApiUrl = 'https://api-v2.rubic.exchange/api';
  private readonly referrerAddress = 'stranded-value-scanner.app';

  // Contract addresses
  private readonly swapExecutorAddress: string;
  private readonly USDC_ETH = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  private readonly USDC_POLYGON = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.swapExecutorAddress = this.configService.get<string>(
      'SWAP_EXECUTOR_ADDRESS',
      '',
    );

    if (!this.swapExecutorAddress) {
      this.logger.warn('SWAP_EXECUTOR_ADDRESS not set. Swaps will not work.');
    }
  }

  /**
   * Get the best swap quote from Rubic
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap (formatted with decimals)
   * @param walletAddress User's wallet address
   * @param chainId Chain ID (e.g., '1' for Ethereum)
   * @returns Swap quote with best rate
   */
  async getSwapQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string,
    chainId: string,
  ): Promise<SwapQuote> {
    try {
      // Validate required parameters
      if (!fromToken || !toToken || !amount || !chainId) {
        throw new Error('Required parameters missing');
      }

      // Default wallet address if not provided
      walletAddress =
        walletAddress || '0x0000000000000000000000000000000000000000';

      const blockchainMap = {
        '1': 'ETH',
        '137': 'POLYGON',
        '56': 'BSC',
        '43114': 'AVALANCHE',
        '42161': 'ARBITRUM',
        '10': 'OPTIMISM',
        '8453': 'BASE',
      };

      const srcTokenBlockchain = blockchainMap[chainId] || 'ETH';
      const dstTokenBlockchain = srcTokenBlockchain; // Same chain swap

      const requestBody: QuoteRequestDto = {
        srcTokenAddress: fromToken.toLowerCase(),
        srcTokenAmount: amount,
        srcTokenBlockchain,
        dstTokenAddress: toToken.toLowerCase(),
        dstTokenBlockchain,
        fromAddress: walletAddress.toLowerCase(),
        receiver: walletAddress.toLowerCase(),
        slippage: 0.35, // 1% slippage
        referrer: this.referrerAddress,
      };

      this.logger.debug('Getting swap quote with params:', requestBody);

      const response = await firstValueFrom(
        this.httpService.post<QuoteResponseDto>(
          `${this.rubicApiUrl}/routes/quoteBest`,
          requestBody,
        ),
      );

      const { estimate, id, provider } = response.data;

      this.logger.debug('Swap quote response:', response.data);

      return {
        id,
        fromToken: {
          address: fromToken,
          symbol: 'TOKEN', // Placeholder, should be fetched from token contract
          name: 'Token Name', // Placeholder, should be fetched from token contract
          decimals: 18, // Should be fetched from token contract
          blockchain: srcTokenBlockchain,
          balance: amount, // Using the input amount as balance
          usdValue: 0, // Placeholder, should be calculated
        },
        toToken: {
          address: toToken,
          symbol: 'USDC', // Placeholder, should be fetched from token contract
          name: 'USD Coin', // Placeholder, should be fetched from token contract
          decimals: 6, // USDC has 6 decimals
          blockchain: dstTokenBlockchain,
          balance: estimate.destinationTokenAmount, // Using the estimated output amount
          usdValue: 0, // Placeholder, should be calculated
        },
        toTokenAmount: estimate.destinationTokenAmount,
        fromTokenAmount: amount,
        protocols: [provider],
        estimatedGas: estimate.estimatedGas || '0',
      };
    } catch (error) {
      this.logger.error(
        `Error getting swap quote: ${error.message}`,
        error.stack,
      );
      if (error.response) {
        this.logger.error('API Response:', error.response.data);
      }
      throw new HttpException(
        `Failed to get swap quote: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the transaction data for a swap
   * @param quoteId ID from the quote response
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap (formatted with decimals)
   * @param walletAddress User's wallet address
   * @param chainId Chain ID (e.g., '1' for Ethereum)
   * @returns Transaction data for the swap
   */
  async getSwapTransaction(
    quoteId: string,
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string,
    chainId: string,
  ): Promise<SwapTransaction> {
    try {
      const blockchainMap = {
        '1': 'ETH',
        '137': 'POLYGON',
        '56': 'BSC',
        '43114': 'AVALANCHE',
        '42161': 'ARBITRUM',
        '10': 'OPTIMISM',
        '8453': 'BASE',
      };

      const srcTokenBlockchain = blockchainMap[chainId] || 'ETH';
      const dstTokenBlockchain = srcTokenBlockchain;

      const requestBody: SwapRequestDto = {
        id: quoteId,
        srcTokenAddress: fromToken.toLowerCase(),
        srcTokenAmount: amount,
        srcTokenBlockchain,
        dstTokenAddress: toToken.toLowerCase(),
        dstTokenBlockchain,
        fromAddress: walletAddress.toLowerCase(),
        receiver: walletAddress.toLowerCase(),
        slippage: 1,
        referrer: this.referrerAddress,
      };

      const response = await firstValueFrom(
        this.httpService.post<SwapResponseDto>(
          `${this.rubicApiUrl}/routes/swap`,
          requestBody,
        ),
      );

      const { transaction } = response.data;

      // Create contract interface
      const swapExecutorABI = [
        'function executeSwap(address _fromToken, address _toToken, uint256 _amount, bytes32 _quoteId, bytes calldata _swapData) external',
      ];
      const swapExecutorInterface = new ethers.Interface(swapExecutorABI);

      // Encode the contract call
      const contractData = swapExecutorInterface.encodeFunctionData(
        'executeSwap',
        [
          fromToken,
          toToken,
          amount,
          ethers.keccak256(ethers.toUtf8Bytes(quoteId)),
          transaction.data,
        ],
      );

      return {
        to: this.swapExecutorAddress,
        data: contractData,
        value: '0',
        gasLimit: transaction.gasLimit || '0',
      };
    } catch (error) {
      this.logger.error(
        `Error getting swap transaction: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get swap transaction: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the status of a swap transaction
   * @param txHash Transaction hash
   * @returns Status of the swap
   */
  async getSwapStatus(txHash: string): Promise<SwapStatus> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<SwapStatus>(
          `${this.rubicApiUrl}/info/status?srcTxHash=${txHash}`,
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error getting swap status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get swap status: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute a gas-sponsored swap transaction
   * @param token Token to swap
   * @param walletAddress User's wallet address
   * @returns Result of the swap
   */
  async executeGasSponsoredSwap(
    token: TokenWithValue,
    walletAddress: string,
  ): Promise<SwapResult> {
    try {
      // 1. Get the best swap quote
      const quote = await this.getSwapQuote(
        token.tokenAddress,
        this.USDC_ETH,
        token.balanceFormatted.toString(),
        walletAddress,
        token.chainId,
      );

      // 2. Get the transaction data
      const transaction = await this.getSwapTransaction(
        quote.id,
        token.tokenAddress,
        this.USDC_ETH,
        token.balanceFormatted.toString(),
        walletAddress,
        token.chainId,
      );

      // 3. Create a provider for the appropriate network
      const isEthereum = token.chainId === '1';
      const rpcUrl = isEthereum
        ? this.configService.get<string>('ETHEREUM_RPC_URL')
        : this.configService.get<string>('POLYGON_RPC_URL');

      if (!rpcUrl) {
        throw new Error(`RPC URL not configured for chain ${token.chainId}`);
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const relayerWallet = new ethers.Wallet(
        this.configService.get<string>('RELAYER_PRIVATE_KEY', ''),
        provider,
      );

      // 4. Estimate gas cost before sending
      const gasEstimate = await provider.estimateGas({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
      });

      const feeData = await provider.getFeeData();
      const gasPriceWei =
        feeData.gasPrice ||
        feeData.maxFeePerGas ||
        ethers.parseUnits('50', 'gwei');
      const gasCostWei = gasEstimate * gasPriceWei;
      const gasCostEth = ethers.formatEther(gasCostWei);

      // 5. Send the transaction
      const tx = await relayerWallet.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: gasEstimate,
      });

      // 6. Wait for transaction to be mined
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction failed');
      }

      return {
        transactionHash: receipt.hash,
        usdcObtained: quote.toTokenAmount,
        gasCost: gasCostEth,
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.error(
        `Error executing gas-sponsored swap: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to execute swap: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a swap quote for a token
   * @param token Token to get quote for
   * @returns Swap quote
   */
  async getTokenSwapQuote(token: TokenWithValue): Promise<SwapQuote> {
    return this.getSwapQuote(
      token.tokenAddress,
      this.USDC_ETH,
      token.balanceFormatted.toString(),
      '', // Will be filled in by the controller
      token.chainId,
    );
  }
}
