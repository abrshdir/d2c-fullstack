import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ethers } from 'ethers';
import { firstValueFrom } from 'rxjs';
import { TokenWithValue } from './token-scanner.service';
import { SwapResult } from './rubic-swap.service';
// Removed GasLoanService import to avoid circular dependency

export interface BridgeQuote {
  id: string;
  srcTokenAddress: string;
  srcTokenAmount: string;
  srcTokenBlockchain: string;
  dstTokenAddress: string;
  dstTokenBlockchain: string;
  destinationTokenAmount: string;
  destinationTokenMinAmount: string;
  priceImpact: number;
  provider: string;
  estimatedGasFee: string;
  bridgeFee: string;
  estimatedTime: string; // Estimated time in minutes
}

export interface BridgeTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
}

export interface BridgeResult extends SwapResult {
  bridgeProvider: string;
  estimatedArrivalTime: number; // Unix timestamp
  destinationTxHash?: string; // Transaction hash on SUI network
  status: BridgeStatus;
}

export enum BridgeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Injectable()
export class SuiBridgeService {
  private readonly logger = new Logger(SuiBridgeService.name);
  private readonly rubicApiUrl = 'https://api-v2.rubic.exchange/api/crosschain';
  private readonly referrerAddress = 'stranded-value-scanner.app';
  private readonly relayerPrivateKey: string;

  // USDC addresses
  private readonly USDC_ETH = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  private readonly USDC_POLYGON = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
  private readonly USDC_SUI =
    '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN'; // SUI USDC address

  // Chain IDs
  private readonly ETHEREUM_CHAIN_ID = '1';
  private readonly POLYGON_CHAIN_ID = '137';
  private readonly SUI_CHAIN_ID = 'SUI';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.relayerPrivateKey = this.configService.get<string>(
      'RELAYER_PRIVATE_KEY',
      '',
    );

    if (!this.relayerPrivateKey) {
      this.logger.warn(
        'RELAYER_PRIVATE_KEY not set. Gas-sponsored bridging will not work.',
      );
    }
  }

  /**
   * Get the best cross-chain bridge quote from Rubic for USDC to SUI
   */
  async getBridgeQuote(token: TokenWithValue): Promise<BridgeQuote> {
    try {
      const isEthereum = token.chainId === this.ETHEREUM_CHAIN_ID;
      const srcTokenAddress = isEthereum ? this.USDC_ETH : this.USDC_POLYGON;
      const srcTokenBlockchain = isEthereum ? 'ETH' : 'POLYGON';

      const response = await firstValueFrom(
        this.httpService.post(`${this.rubicApiUrl}/quoteBest`, {
          srcTokenAddress,
          srcTokenAmount: token.balanceFormatted.toString(),
          srcTokenBlockchain,
          dstTokenAddress: this.USDC_SUI,
          dstTokenBlockchain: this.SUI_CHAIN_ID,
          referrer: this.referrerAddress,
        }),
      );

      const { estimate, id, provider } = response.data;

      return {
        id,
        srcTokenAddress,
        srcTokenAmount: token.balanceFormatted.toString(),
        srcTokenBlockchain,
        dstTokenAddress: this.USDC_SUI,
        dstTokenBlockchain: this.SUI_CHAIN_ID,
        destinationTokenAmount: estimate.destinationTokenAmount,
        destinationTokenMinAmount: estimate.destinationTokenMinAmount,
        priceImpact: estimate.priceImpact,
        provider,
        estimatedGasFee: estimate.estimatedGas || '0',
        bridgeFee: estimate.bridgeFee || '0',
        estimatedTime: estimate.estimatedTime || '30', // Default to 30 minutes if not provided
      };
    } catch (error) {
      this.logger.error(
        `Error getting bridge quote for token ${token.symbol}: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get bridge quote: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the transaction data for a cross-chain bridge
   */
  async getBridgeTransaction(
    quote: BridgeQuote,
    walletAddress: string,
    destinationAddress: string,
  ): Promise<BridgeTransaction> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.rubicApiUrl}/swap`, {
          srcTokenAddress: quote.srcTokenAddress,
          srcTokenAmount: quote.srcTokenAmount,
          srcTokenBlockchain: quote.srcTokenBlockchain,
          dstTokenAddress: quote.dstTokenAddress,
          dstTokenBlockchain: quote.dstTokenBlockchain,
          referrer: this.referrerAddress,
          fromAddress: walletAddress,
          id: quote.id,
          receiver: destinationAddress, // The SUI wallet address to receive the bridged tokens
        }),
      );

      const { transaction } = response.data;

      return {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || '0',
        gasLimit: transaction.gasLimit || '0',
      };
    } catch (error) {
      this.logger.error(
        `Error getting bridge transaction: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get bridge transaction: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute a gas-sponsored cross-chain bridge transaction
   */
  async executeGasSponsoredBridge(
    token: TokenWithValue,
    sourceWalletAddress: string,
    destinationWalletAddress: string,
  ): Promise<BridgeResult> {
    try {
      // 1. Get the best bridge quote
      const quote = await this.getBridgeQuote(token);

      // 2. Get the transaction data
      const transaction = await this.getBridgeTransaction(
        quote,
        sourceWalletAddress,
        destinationWalletAddress,
      );

      // 3. Create a provider for the appropriate network
      const isEthereum = token.chainId === this.ETHEREUM_CHAIN_ID;
      const rpcUrl = isEthereum
        ? this.configService.get<string>('ETHEREUM_RPC_URL')
        : this.configService.get<string>('POLYGON_RPC_URL');

      if (!rpcUrl) {
        throw new Error(`RPC URL not configured for chain ${token.chainId}`);
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const relayerWallet = new ethers.Wallet(this.relayerPrivateKey, provider);

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

      // 7. Lock collateral and record gas loan
      try {
        const usdcAmountBigNum = ethers.parseUnits(
          quote.destinationTokenAmount,
          6,
        ); // Assuming USDC has 6 decimals

        // Placeholder for ETH/MATIC to USDC conversion for gas cost
        // In a real implementation, we'd track the gas cost for the user
        const nativeTokenPriceInUsd = isEthereum ? 3000 : 1; // Example: 1 ETH = 3000 USD, 1 MATIC = 1 USD
        const gasCostInUsd = parseFloat(gasCostEth) * nativeTokenPriceInUsd;
        
        this.logger.log(
          `Bridge complete for ${quote.destinationTokenAmount} USDC for user ${sourceWalletAddress} with gas cost ${gasCostInUsd.toFixed(6)} USD.`,
        );
      } catch (lockError) {
        this.logger.error(
          `Error locking collateral for user ${sourceWalletAddress} after bridge ${receipt.hash}: ${lockError.message}`,
          lockError.stack,
        );
        // Decide if this error should make the whole operation fail or just be logged
        // For now, we'll log it and still return the bridge result, but this might need adjustment.
      }

      // 8. Calculate estimated arrival time (current time + estimated minutes from quote)
      const currentTime = Math.floor(Date.now() / 1000);
      const estimatedArrivalTime =
        currentTime + parseInt(quote.estimatedTime) * 60;

      // 9. Return the result
      return {
        transactionHash: receipt.hash,
        usdcObtained: quote.destinationTokenAmount,
        gasCost: gasCostEth,
        timestamp: currentTime,
        bridgeProvider: quote.provider,
        estimatedArrivalTime,
        status: BridgeStatus.PENDING,
      };
    } catch (error) {
      this.logger.error(
        `Error executing gas-sponsored bridge: ${error.message}`,
        error.stack,
      );

      // Handle specific error types
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle network-related errors
      if (error.code === 'NETWORK_ERROR' || error.message.includes('network')) {
        throw new HttpException(
          'Network error occurred while bridging. Please check your connection and try again.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Handle insufficient funds errors
      if (error.message.includes('insufficient funds') || error.message.includes('gas required')) {
        throw new HttpException(
          'Insufficient funds to complete the bridge transaction. Please ensure you have enough native tokens for gas.',
          HttpStatus.BAD_REQUEST
        );
      }

      // Handle contract-related errors
      if (error.message.includes('contract') || error.message.includes('transaction')) {
        throw new HttpException(
          'Smart contract error occurred. The bridge contract may be paused or the transaction may be invalid.',
          HttpStatus.BAD_REQUEST
        );
      }

      // Handle validation errors
      if (error.message.includes('invalid') || error.message.includes('validation')) {
        throw new HttpException(
          `Invalid bridge request: ${error.message}`,
          HttpStatus.BAD_REQUEST
        );
      }

      // Default error handling
      throw new HttpException(
        `Failed to execute bridge: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Check the status of a bridge transaction
   */
  async checkBridgeStatus(transactionHash: string): Promise<BridgeStatus> {
    try {
      // In a real implementation, this would query Rubic's API or use webhooks
      // to get the current status of the bridge transaction
      const response = await firstValueFrom(
        this.httpService.get(`${this.rubicApiUrl}/status/${transactionHash}`),
      );

      const { status } = response.data;

      switch (status.toLowerCase()) {
        case 'completed':
          return BridgeStatus.COMPLETED;
        case 'failed':
          return BridgeStatus.FAILED;
        default:
          return BridgeStatus.PENDING;
      }
    } catch (error) {
      this.logger.error(
        `Error checking bridge status for tx ${transactionHash}: ${error.message}`,
        error.stack,
      );
      // If we can't check the status, assume it's still pending
      return BridgeStatus.PENDING;
    }
  }

  /**
   * Update the status of a bridge transaction when a webhook is received
   */
  async updateBridgeStatus(
    transactionHash: string,
    status: BridgeStatus,
    destinationTxHash?: string,
  ): Promise<boolean> {
    try {
      // In a real implementation, this would update the status in your database
      // and record the destination transaction hash on the SUI network
      this.logger.log(
        `Bridge status updated for tx ${transactionHash}: ${status}${destinationTxHash ? `, destination tx: ${destinationTxHash}` : ''}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Error updating bridge status for tx ${transactionHash}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Get detailed information about a bridge transaction
   */
  async getBridgeDetails(transactionHash: string): Promise<{
    status: BridgeStatus;
    destinationTxHash?: string;
    destinationAmount?: string;
    estimatedCompletionTime?: number;
  }> {
    try {
      // In a real implementation, this would query Rubic's API
      // to get detailed information about the bridge transaction
      const response = await firstValueFrom(
        this.httpService.get(`${this.rubicApiUrl}/transactions/${transactionHash}`),
      );

      const { status, destinationTxHash, amount, estimatedTime } = response.data;
      const currentTime = Math.floor(Date.now() / 1000);
      
      return {
        status: this.mapStatusToBridgeStatus(status),
        destinationTxHash,
        destinationAmount: amount,
        estimatedCompletionTime: currentTime + (estimatedTime * 60),
      };
    } catch (error) {
      this.logger.warn(
        `Error getting bridge details for tx ${transactionHash}: ${error.message}`,
      );
      
      // If we can't get the details, return a default response with pending status
      return {
        status: BridgeStatus.PENDING,
      };
    }
  }
  
  /**
   * Map API status string to BridgeStatus enum
   */
  private mapStatusToBridgeStatus(status: string): BridgeStatus {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'done':
        return BridgeStatus.COMPLETED;
      case 'failed':
      case 'error':
      case 'rejected':
        return BridgeStatus.FAILED;
      default:
        return BridgeStatus.PENDING;
    }
  }
}
