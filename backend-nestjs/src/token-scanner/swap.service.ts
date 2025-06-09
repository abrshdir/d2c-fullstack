import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ethers } from 'ethers';
import { firstValueFrom } from 'rxjs';
import { TokenWithValue } from './token-scanner.service';
import { SmartContractService } from './services/smart-contract.service';
import { DatabaseService } from './services/database.service';
import {
  TransactionStatus,
  TransactionType,
  Transaction,
} from './schemas/transaction.schema';
import {
  SwapQuote,
  SwapRequestDto,
  SwapResponseDto,
  SwapResult,
  SwapStatus,
  SwapTransaction,
  ProtocolinkQuoteResponseDto,
} from './types/rubic-types';
import * as api from '@protocolink/api';

@Injectable()
export class RubicSwapService {
  private readonly logger = new Logger(RubicSwapService.name);
  private readonly oneInchApiUrl = 'https://api.1inch.io/swap/v6.0';
  private readonly referrerAddress = 'stranded-value-scanner.app';

  // Contract addresses
  private readonly swapExecutorAddress: string;
  private readonly USDC_ETH = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  private readonly USDC_POLYGON = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly smartContractService: SmartContractService,
    private readonly databaseService: DatabaseService,
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
   * Get the best swap quote from 1inch
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap (formatted with decimals)
   * @param walletAddress User's wallet address
   * @param chainId Chain ID (e.g., '1' for Ethereum)
   * @param referrer Referrer address
   * @returns Swap quote with best rate
   */
  async getSwapQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string,
    chainId: string,
    referrer?: string,
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
        '1': 'ethereum',
        '137': 'polygon',
        '56': 'bsc',
        '43114': 'avalanche',
        '42161': 'arbitrum',
        '10': 'optimism',
        '8453': 'base',
      };

      const chain = blockchainMap[chainId] || 'ethereum';

      // Build 1inch API URL with query parameters
      const url =
        `${this.oneInchApiUrl}/${chain}/quote?` +
        new URLSearchParams({
          fromTokenAddress: fromToken.toLowerCase(),
          toTokenAddress: toToken.toLowerCase(),
          amount: amount,
          walletAddress: walletAddress.toLowerCase(),
          slippage: '0.30', // 1% slippage
          fee: '0', // No fee
          allowPartialFill: 'false',
          protocols: 'UNISWAP_V3,UNISWAP_V2,SUSHISWAP,CURVE,BALANCER_V2', // Major DEXes
          referrer: referrer || this.referrerAddress,
        }).toString();

      this.logger.debug('Getting swap quote with params:', url);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Accept: 'application/json',
          },
        }),
      );

      this.logger.debug('response params:', response.data);

      // Check for error response
      if (response.data.error) {
        throw new HttpException(
          `Failed to get swap quote: ${response.data.error}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const { toTokenAmount, fromTokenAmount, protocols, gas } = response.data;

      // Validate the response data
      if (!toTokenAmount || !fromTokenAmount) {
        throw new HttpException(
          'Invalid response from 1inch API: Missing required quote data',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.debug('Swap quote response:', response.data);

      return {
        id: response.data.id || '1inch-quote',
        fromToken: {
          address: fromToken,
          symbol: 'TOKEN', // Placeholder, should be fetched from token contract
          name: 'Token Name', // Placeholder, should be fetched from token contract
          decimals: 18, // Should be fetched from token contract
          blockchain: chain,
          balance: amount,
          usdValue: 0, // Placeholder, should be calculated
        },
        toToken: {
          address: toToken,
          symbol: 'USDC', // Placeholder, should be fetched from token contract
          name: 'USD Coin', // Placeholder, should be fetched from token contract
          decimals: 6, // USDC has 6 decimals
          blockchain: chain,
          balance: toTokenAmount,
          usdValue: 0, // Placeholder, should be calculated
        },
        toTokenAmount,
        fromTokenAmount,
        protocols: protocols || ['1inch'],
        estimatedGas: gas || '0',
      };
    } catch (error) {
      this.logger.error(
        `Error getting swap quote: ${error.message}`,
        error.stack,
      );

      // If it's already an HttpException, rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle axios errors
      if (error.response) {
        this.logger.error('API Response:', error.response.data);
        throw new HttpException(
          `1inch API error: ${error.response.data.error || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Handle other errors
      throw new HttpException(
        `Failed to get swap quote: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
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
          `${this.oneInchApiUrl}/routes/swap`,
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
          `${this.oneInchApiUrl}/info/status?srcTxHash=${txHash}`,
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
      // Get the best swap quote
      const quote = await this.getTokenSwapQuote(token);

      // Execute the swap
      const swapTx = await this.getSwapTransaction(
        quote.id,
        token.address,
        this.USDC_ETH,
        token.value.toString(),
        walletAddress,
        token.chainId
      );

      // Send the transaction
      const tx = await this.smartContractService.sendTransaction(swapTx);

      // Create transaction record
      await this.databaseService.createTransaction({
        walletAddress,
        type: TransactionType.SWAP,
        amount: token.value.toString(),
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        transactionHash: tx.hash,
        status: TransactionStatus.PENDING,
        details: {
          quoteId: quote.id,
          toToken: this.USDC_ETH,
          toTokenAmount: quote.toTokenAmount,
        },
      });

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      return {
        transactionHash: receipt.hash,
        usdcObtained: quote.toTokenAmount,
        gasCost: receipt.gasUsed.toString(),
        timestamp: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.error('Error executing gas sponsored swap:', error);
      throw error;
    }
  }

  /**
   * Get a swap quote for a token
   * @param token Token to get quote for
   * @returns Swap quote
   */
  async getTokenSwapQuote(token: TokenWithValue): Promise<SwapQuote> {
    return this.getSwapQuote(
      token.address,
      this.USDC_ETH,
      token.value.toString(),
      '', // Will be filled in by the controller
      '1', // Ethereum mainnet
    );
  }

  async executeSwap(
    fromToken: string,
    toToken: string,
    amount: bigint,
    userAddress: string,
  ) {
    try {
      // Get quote from Rubic API
      const quote = await this.getRubicQuote(fromToken, toToken, amount);

      // Create initial transaction record
      const transaction = await this.databaseService.createTransaction({
        walletAddress: userAddress,
        type: TransactionType.SWAP,
        amount: amount.toString(),
        tokenAddress: fromToken,
        status: TransactionStatus.PENDING,
        details: {
          toToken,
          quoteId: quote.quoteId,
        },
        createdAt: new Date(),
      });

      // Execute swap through contract
      const tx = await this.smartContractService.executeSwap(
        fromToken,
        toToken,
        amount,
        quote.quoteId,
        quote.swapData,
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      if (!receipt) {
        await this.databaseService.updateTransaction(transaction.id, {
          status: TransactionStatus.FAILED,
        });
        throw new Error('Transaction receipt is null');
      }

      await this.databaseService.updateTransaction(transaction.id, {
        transactionHash: receipt.hash,
        status: TransactionStatus.CONFIRMED,
      });

      const swapEvents = receipt.logs.filter(
        (log) =>
          log.topics[0] === this.smartContractService.getSwapEventTopic(),
      );

      if (swapEvents.length > 0) {
        const swapEvent = this.smartContractService.parseSwapEvent(
          swapEvents[0],
        );
        const gasDebt = this.calculateGasDebt(swapEvent);

        await this.databaseService.updateTransaction(transaction.id, {
          details: {
            ...transaction.details,
            gasDebt: gasDebt.toString(),
            completedAt: new Date(),
          },
        });

        return {
          txHash: receipt.hash,
          fromAmount: swapEvent.args.fromAmount,
          toAmount: swapEvent.args.toAmount,
          quoteId: quote.quoteId,
        };
      }

      throw new Error('Swap transaction failed or no swap event found');
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  private async getRubicQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
  ) {
    // Implementation of Rubic API quote request
    // This would make an HTTP request to Rubic's API
    // For now, returning mock data
    return {
      quoteId: 'mock-quote-id',
      swapData: 'mock-swap-data',
    };
  }

  // Event handlers
  async handleSwapEvent(event: any) {
    try {
      const { user, fromToken, toToken, fromAmount, toAmount, quoteId } =
        event.args;

      // Update transaction status in database
      await this.databaseService.updateTransactionByQuoteId(quoteId, {
        status: TransactionStatus.CONFIRMED,
        details: {
          completedAt: new Date(),
        },
      });

      // Create gas loan for the user
      const gasDebt = this.calculateGasDebt(event);
      await this.smartContractService.depositForUser(user, toAmount, gasDebt);
    } catch (error) {
      console.error('Error handling swap event:', error);
    }
  }

  private calculateGasDebt(event: any): bigint {
    // Calculate gas debt based on transaction
    // This would include gas price and gas used
    // For now, returning a mock value
    return BigInt(1000000); // 0.001 ETH
  }

  async getGasLoanQuote(
    token: TokenWithValue,
    walletAddress: string,
  ): Promise<SwapQuote> {
    try {
      // Get USDC address based on chain
      const usdcAddress =
        token.chainId === '137' ? this.USDC_POLYGON : this.USDC_ETH;

      // Get swap quote
      const quote = await this.getSwapQuote(
        token.tokenAddress,
        usdcAddress,
        token.value.toString(),
        walletAddress,
        token.chainId,
        this.referrerAddress,
      );

      return quote;
    } catch (error) {
      this.logger.error(
        `Error getting gas loan quote: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a swap quote from Protocolink API
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap (formatted with decimals)
   * @param walletAddress User's wallet address
   * @param chainId Chain ID (e.g., '1' for Ethereum)
   * @param referrer Referrer address
   * @returns Swap quote with best rate
   */
  async getSwapQuoteProtocolink(
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string,
    chainId: string,
    referrer?: string,
  ): Promise<SwapQuote> {
    try {
      // Validate required parameters
      if (!fromToken || !toToken || !amount || !chainId) {
        throw new Error('Required parameters missing');
      }

      const chainIdNum = parseInt(chainId);

      // Get token list for the chain
      const tokenList =
        await api.protocols.uniswapv3.getSwapTokenTokenList(chainIdNum);

      // Find input and output tokens in the list
      const inputToken = tokenList.find(
        (token) => token.address.toLowerCase() === fromToken.toLowerCase(),
      );
      const outputToken = tokenList.find(
        (token) => token.address.toLowerCase() === toToken.toLowerCase(),
      );

      if (!inputToken || !outputToken) {
        throw new Error('One or both tokens not supported on this chain');
      }

      // Get swap quote from Protocolink
      const swapTokenQuotation =
        await api.protocols.uniswapv3.getSwapTokenQuotation(chainIdNum, {
          input: {
            token: inputToken,
            amount: amount,
          },
          tokenOut: outputToken,
          slippage: 50, // 0.5%
        });

      // Build router data
      const routerData = {
        chainId: chainIdNum,
        account: walletAddress,
        logics: [{
          rid: 'uniswap-v3:swap-token',
          fields: swapTokenQuotation
        }]
      };

      // Get router transaction data with permit type
      const routerTx = await api.estimateRouterData(routerData, { permit2Type: 'permit' });
      
      // Calculate total fees from router response
      const totalFees = routerTx.fees.reduce((acc, fee) => {
        if (fee.feeAmount.token.symbol === 'ETH') {
          return acc + parseFloat(fee.feeAmount.amount);
        }
        return acc;
      }, 0);

      // Get ETH price from a price feed service (using 1800 as fallback)
      const ethPrice = 1800; // TODO: Replace with actual price feed
      const gasCostInUsd = (totalFees * ethPrice).toFixed(2);

      this.logger.debug('Protocolink swap quote response:', {
        swapTokenQuotation,
        routerTx,
        totalFees,
        gasCostInUsd
      });
      
      // Transform the response to match our SwapQuote format
      return {
        id: 'protocolink-quote',
        fromToken: {
          address: swapTokenQuotation.input.token.address,
          symbol: swapTokenQuotation.input.token.symbol,
          name: swapTokenQuotation.input.token.name,
          decimals: swapTokenQuotation.input.token.decimals,
          blockchain: 'ETH',
          balance: '0',
          usdValue: 0,
        },
        toToken: {
          address: swapTokenQuotation.output.token.address,
          symbol: swapTokenQuotation.output.token.symbol,
          name: swapTokenQuotation.output.token.name,
          decimals: swapTokenQuotation.output.token.decimals,
          blockchain: 'ETH',
          balance: '0',
          usdValue: 0,
        },
        toTokenAmount: swapTokenQuotation.output.amount,
        fromTokenAmount: swapTokenQuotation.input.amount,
        protocols: ['protocolink'],
        estimatedGas: {
          gasEstimate: totalFees.toString(),
          gasCostInEth: totalFees.toString(),
          gasCostInUsd
        }
      };
    } catch (error) {
      this.logger.error(
        `Error getting Protocolink swap quote: ${error.message}`,
        error.stack,
      );

      // Handle specific Protocolink errors
      if (error.response) {
        this.logger.error('API Response:', error.response.data);
        throw new HttpException(
          `Protocolink API error: ${error.response.data.error || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Handle other errors
      throw new HttpException(
        `Failed to get Protocolink swap quote: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a swap quote from Uniswap V3 on Sepolia testnet
   * @param fromToken Source token address
   * @param toToken Destination token address
   * @param amount Amount to swap (formatted with decimals)
   * @param walletAddress User's wallet address
   * @returns Swap quote with best rate
   */
  async getSwapQuoteUniswapV3Testnet(
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string,
  ): Promise<SwapQuote> {
    try {
      // Validate required parameters
      if (!fromToken || !toToken || !amount) {
        throw new Error('Required parameters missing');
      }

      // Sepolia chain ID
      const chainId = 11155111;

      // Get token list for Sepolia
      const tokenList = await api.protocols.uniswapv3.getSwapTokenTokenList(chainId);

      // Find input and output tokens in the list
      const inputToken = tokenList.find(
        (token) => token.address.toLowerCase() === fromToken.toLowerCase(),
      );
      const outputToken = tokenList.find(
        (token) => token.address.toLowerCase() === toToken.toLowerCase(),
      );

      if (!inputToken || !outputToken) {
        throw new Error('One or both tokens not supported on Sepolia');
      }

      // Create swap quotation data similar to Protocolink's format
      const swapTokenQuotation = {
        input: {
          token: inputToken,
          amount: amount,
        },
        output: {
          token: outputToken,
          amount: '0', // Will be calculated
        },
        slippage: 50, // 0.5%
      };

      // Build router data using Protocolink's structure
      const routerData = {
        chainId: chainId,
        account: walletAddress,
        logics: [{
          rid: 'uniswap-v2:swap-token',
          fields: swapTokenQuotation
        }]
      };

      // Get router transaction data with permit type
      const routerTx = await api.estimateRouterData(routerData, { permit2Type: 'permit' });
      
      // Calculate total fees from router response
      const totalFees = routerTx.fees.reduce((acc, fee) => {
        if (fee.feeAmount.token.symbol === 'ETH') {
          return acc + parseFloat(fee.feeAmount.amount);
        }
        return acc;
      }, 0);

      // Get ETH price from a price feed service (using 1800 as fallback)
      const ethPrice = 1800; // TODO: Replace with actual price feed
      const gasCostInUsd = (totalFees * ethPrice).toFixed(2);

      this.logger.debug('Uniswap V3 testnet swap quote response:', {
        swapTokenQuotation,
        routerTx,
        totalFees,
        gasCostInUsd
      });
      
      // Transform the response to match our SwapQuote format
      return {
        id: 'uniswap-v3-testnet-quote',
        fromToken: {
          address: swapTokenQuotation.input.token.address,
          symbol: swapTokenQuotation.input.token.symbol,
          name: swapTokenQuotation.input.token.name,
          decimals: swapTokenQuotation.input.token.decimals,
          blockchain: 'SEPOLIA',
          balance: '0',
          usdValue: 0,
        },
        toToken: {
          address: swapTokenQuotation.output.token.address,
          symbol: swapTokenQuotation.output.token.symbol,
          name: swapTokenQuotation.output.token.name,
          decimals: swapTokenQuotation.output.token.decimals,
          blockchain: 'SEPOLIA',
          balance: '0',
          usdValue: 0,
        },
        toTokenAmount: swapTokenQuotation.output.amount,
        fromTokenAmount: swapTokenQuotation.input.amount,
        protocols: ['uniswap-v3'],
        estimatedGas: {
          gasEstimate: totalFees.toString(),
          gasCostInEth: totalFees.toString(),
          gasCostInUsd
        }
      };
    } catch (error) {
      this.logger.error(
        `Error getting Uniswap V3 testnet swap quote: ${error.message}`,
        error.stack,
      );

      // Handle specific Uniswap errors
      if (error.response) {
        this.logger.error('API Response:', error.response.data);
        throw new HttpException(
          `Uniswap V3 API error: ${error.response.data.error || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Handle other errors
      throw new HttpException(
        `Failed to get Uniswap V3 testnet swap quote: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
