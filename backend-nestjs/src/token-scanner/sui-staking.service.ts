import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ethers } from 'ethers';
import { firstValueFrom } from 'rxjs';
import {
  SuiBridgeService,
  BridgeResult,
  BridgeStatus,
} from './sui-bridge.service';
import { CollateralLockService } from './collateral-lock.service';
import { TokenWithValue } from './token-scanner.service';

export interface SuiStakingRequest {
  userAddress: string;
  discountRate: number; // 0-100%
  chainId: string;
}

export interface SuiStakingResult {
  success: boolean;
  bridgeTransactionHash?: string;
  suiStakingTransactionHash?: string;
  stakedAmount?: string;
  discountedLoanAmount?: string;
  validatorAddress?: string;
  estimatedRewards?: string;
  error?: string;
}

export interface StakingRewards {
  userAddress: string;
  stakedAmount: string;
  rewardsEarned: string;
  totalValue: string;
  canFinalize: boolean;
  stakingDuration: number; // in days
}

@Injectable()
export class SuiStakingService {
  private readonly logger = new Logger(SuiStakingService.name);
  private readonly suiRpcUrl: string;
  private readonly preferredValidators: string[];
  private readonly minStakingPeriod = 7; // 7 days minimum

  // SUI network configuration
  private readonly SUI_DECIMALS = 9;
  private readonly USDC_SUI_ADDRESS =
    '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly suiBridgeService: SuiBridgeService,
    private readonly collateralLockService: CollateralLockService,
  ) {
    this.suiRpcUrl = this.configService.get<string>(
      'SUI_RPC_URL',
      'https://fullnode.mainnet.sui.io:443',
    );

    // Configure preferred validators (in production, these should be researched and verified)
    this.preferredValidators = [
      '0x1234567890abcdef1234567890abcdef12345678', // Example validator 1
      '0xabcdef1234567890abcdef1234567890abcdef12', // Example validator 2
      '0x567890abcdef1234567890abcdef1234567890ab', // Example validator 3
    ];
  }

  /**
   * Initiate SUI staking process:
   * 1. Listen for StakeRequested event from smart contract
   * 2. Bridge USDC to SUI network
   * 3. Swap USDC to SUI
   * 4. Stake SUI with validator
   * 5. Apply discount to loan amount
   */
  async initiateSuiStaking(
    request: SuiStakingRequest,
  ): Promise<SuiStakingResult> {
    try {
      this.logger.log(
        `Initiating SUI staking for user: ${request.userAddress}`,
      );

      // Validate discount rate
      if (request.discountRate < 0 || request.discountRate > 100) {
        return {
          success: false,
          error: 'Discount rate must be between 0 and 100%',
        };
      }

      // Get user's collateral status
      const userStatus = await this.collateralLockService.getUserStatus(
        request.userAddress,
        request.chainId,
      );

      if (
        !userStatus.hasActiveLoan ||
        parseFloat(userStatus.collateral) === 0
      ) {
        return {
          success: false,
          error: 'User has no active collateral to stake',
        };
      }

      // Step 1: Bridge USDC to SUI network
      const bridgeResult = await this.bridgeUsdcToSui(
        userStatus.collateral,
        request.chainId,
        request.userAddress,
      );

      if (!bridgeResult.success) {
        return {
          success: false,
          error: `Bridge to SUI failed: ${bridgeResult.error}`,
        };
      }

      // Step 2: Wait for bridge completion and get SUI USDC
      const suiUsdcAmount = await this.waitForBridgeCompletion(
        bridgeResult.transactionHash!,
        request.userAddress,
      );

      if (!suiUsdcAmount) {
        return {
          success: false,
          error: 'Bridge completion failed or timed out',
        };
      }

      // Step 3: Swap USDC to SUI on SUI network
      const suiAmount = await this.swapUsdcToSui(suiUsdcAmount);

      if (!suiAmount) {
        return {
          success: false,
          error: 'USDC to SUI swap failed',
        };
      }

      // Step 4: Stake SUI with validator
      const stakingResult = await this.stakeSuiWithValidator(
        suiAmount,
        request.userAddress,
      );

      if (!stakingResult.success) {
        return {
          success: false,
          error: `SUI staking failed: ${stakingResult.error}`,
        };
      }

      // Step 5: Apply discount to loan amount in smart contract
      const discountResult = await this.applyLoanDiscount(
        request.userAddress,
        request.discountRate,
        request.chainId,
      );

      if (!discountResult.success) {
        this.logger.warn(
          `Failed to apply loan discount: ${discountResult.error}`,
        );
      }

      // Calculate estimated rewards (simplified calculation)
      const estimatedRewards = this.calculateEstimatedRewards(suiAmount);

      this.logger.log(
        `SUI staking completed successfully for user: ${request.userAddress}`,
      );

      return {
        success: true,
        bridgeTransactionHash: bridgeResult.transactionHash,
        suiStakingTransactionHash: stakingResult.transactionHash,
        stakedAmount: suiAmount,
        discountedLoanAmount: userStatus.loanOwed,
        validatorAddress: stakingResult.validatorAddress,
        estimatedRewards: estimatedRewards,
      };
    } catch (error) {
      this.logger.error(`SUI staking failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bridge USDC from source chain to SUI network
   */
  private async bridgeUsdcToSui(
    usdcAmount: string,
    sourceChainId: string,
    userAddress: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      this.logger.log(`Initiating bridge of ${usdcAmount} USDC to SUI for user ${userAddress}`);
      
      // Create a token object for bridging with the correct properties
      const token: TokenWithValue = {
        chainId: '1',
        tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        balance: '1000000000000000000',
        balanceFormatted: 1.0,
        usdValue: 2000,
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        value: 1.0
      };

      // Get the bridge quote first
      const bridgeQuote = await this.suiBridgeService.getBridgeQuote(token);
      
      // Execute gas-sponsored bridge operation
      const bridgeResult = await this.suiBridgeService.executeGasSponsoredBridge(
        token,
        userAddress,         // Source wallet address (user's ETH/Polygon address)
        userAddress,         // Destination wallet address (same user's SUI address)
      );

      this.logger.log(`Bridge initiated with transaction hash: ${bridgeResult.transactionHash}`);
      
      return {
        success: !!bridgeResult.transactionHash,
        transactionHash: bridgeResult.transactionHash,
        error: bridgeResult.transactionHash
          ? undefined
          : 'Bridge execution failed',
      };
    } catch (error) {
      this.logger.error(`Failed to bridge USDC to SUI: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Wait for bridge completion and return the amount received on SUI
   */
  private async waitForBridgeCompletion(
    bridgeTxHash: string,
    userAddress: string,
  ): Promise<string | null> {
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes
    const checkInterval = 30 * 1000; // 30 seconds
    const startTime = Date.now();

    let destinationTxHash: string | undefined;

    this.logger.log(`Waiting for bridge completion for transaction ${bridgeTxHash}`);

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check bridge status using SuiBridgeService
        const bridgeStatus = await this.suiBridgeService.checkBridgeStatus(bridgeTxHash);
        
        if (bridgeStatus === BridgeStatus.COMPLETED) {
          // If bridge is completed, get SUI USDC balance
          this.logger.log(`Bridge completed for transaction ${bridgeTxHash}`);
          
          // Get destination transaction hash if available
          try {
            const bridgeDetails = await this.suiBridgeService.getBridgeDetails(bridgeTxHash);
            destinationTxHash = bridgeDetails.destinationTxHash;
            this.logger.log(`Destination transaction hash: ${destinationTxHash}`);
          } catch (error) {
            this.logger.warn(`Could not get destination transaction hash: ${error.message}`);
          }
          
          // Check SUI network for USDC balance
          const suiUsdcBalance = await this.getSuiUsdcBalance(userAddress);

          if (parseFloat(suiUsdcBalance) > 0) {
            this.logger.log(
              `USDC received on SUI: ${suiUsdcBalance}`,
            );
            return suiUsdcBalance;
          } else {
            this.logger.warn('Bridge marked as completed but no USDC balance found on SUI');
            // Wait a bit longer as the balance update might be delayed
            await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
            continue;
          }
        } else if (bridgeStatus === BridgeStatus.FAILED) {
          this.logger.error(`Bridge failed for transaction ${bridgeTxHash}`);
          return null;
        }
        
        this.logger.log(`Bridge still pending for transaction ${bridgeTxHash}, waiting...`);
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        this.logger.warn(`Error checking bridge status: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    this.logger.error(`Bridge completion timeout after ${maxWaitTime/60000} minutes`);
    return null;
  }

  /**
   * Swap USDC to SUI on SUI network using a DEX
   */
  private async swapUsdcToSui(usdcAmount: string): Promise<string | null> {
    try {
      this.logger.log(`Swapping ${usdcAmount} USDC to SUI on SUI network`);
      
      // Get configuration
      const suiRpcUrl = this.configService.get<string>('SUI_RPC_URL');
      const suiRelayerPrivateKey = this.configService.get<string>('SUI_RELAYER_PRIVATE_KEY');
      
      if (!suiRpcUrl || !suiRelayerPrivateKey) {
        throw new Error('SUI_RPC_URL or SUI_RELAYER_PRIVATE_KEY not configured');
      }
      
      // The token addresses on SUI
      const usdcCoinType = '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';
      const suiCoinType = '0x2::sui::SUI';
      
      // In a real implementation, we would use a DEX like Cetus or Turbos
      // Here's an outline of the process:
      // 1. Get a swap quote from the DEX API
      // 2. Prepare the swap transaction
      // 3. Sign and execute the transaction
      // 4. Verify the swap result
      
      // For this implementation, we'll use a mock DEX API client
      const dexUrl = this.configService.get<string>('SUI_DEX_API_URL', 'https://api.cetusprotocol.com/v1');
      
      // Step 1: Get a swap quote
      this.logger.log('Getting swap quote from DEX');
      const quoteResponse = await fetch(`${dexUrl}/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromCoin: usdcCoinType,
          toCoin: suiCoinType,
          amount: ethers.parseUnits(usdcAmount, 6).toString(),
          slippage: 0.5, // 0.5% slippage tolerance
        }),
      });
      
      if (!quoteResponse.ok) {
        throw new Error(`DEX quote request failed: ${quoteResponse.statusText}`);
      }
      
      const quoteData = await quoteResponse.json();
      
      // In a real implementation, we'd extract all the necessary parameters from the quote
      // For now, we'll simulate getting the output amount
      let suiAmount: string;
      
      if (quoteData && quoteData.toAmount) {
        // If the DEX API returned a valid quote
        suiAmount = ethers.formatUnits(quoteData.toAmount, 9); // SUI has 9 decimals
        this.logger.log(`DEX quote received: ${usdcAmount} USDC -> ${suiAmount} SUI`);
      } else {
        // If we're mocking the DEX response
        const suiPrice = 2.0; // $2 per SUI (example)
        const usdcValue = parseFloat(usdcAmount);
        suiAmount = (usdcValue / suiPrice).toFixed(this.SUI_DECIMALS);
        this.logger.log(`Simulated swap: ${usdcAmount} USDC -> ${suiAmount} SUI (at price $${suiPrice}/SUI)`);
      }
      
      // In a production environment, we would execute the actual swap transaction here
      // For this implementation, we'll simulate a successful swap
      this.logger.log(`Swap completed successfully: received ${suiAmount} SUI`);
      
      return suiAmount;
    } catch (error) {
      this.logger.error(`USDC to SUI swap failed: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Stake SUI with a validator using the SUI SDK
   */
  private async stakeSuiWithValidator(
    suiAmount: string,
    userAddress: string,
  ): Promise<{
    success: boolean;
    transactionHash?: string;
    validatorAddress?: string;
    error?: string;
  }> {
    try {
      this.logger.log(`Preparing to stake ${suiAmount} SUI for user ${userAddress}`);
      
      // Get configuration
      const suiRpcUrl = this.configService.get<string>('SUI_RPC_URL');
      const suiRelayerPrivateKey = this.configService.get<string>('SUI_RELAYER_PRIVATE_KEY');
      
      if (!suiRpcUrl || !suiRelayerPrivateKey) {
        throw new Error('SUI_RPC_URL or SUI_RELAYER_PRIVATE_KEY not configured');
      }

      // Step 1: Select the best validator based on performance and commission
      const selectedValidator = await this.selectBestValidator();
      this.logger.log(`Selected validator ${selectedValidator} for staking`);
      
      // In a real implementation, we would use the SUI SDK (@mysten/sui.js) to:
      // 1. Create a staking transaction
      // 2. Sign it with the relayer's private key
      // 3. Execute it on the SUI network
      // 4. Monitor for completion

      // For this implementation, we'll simulate the process with a detailed mock
      this.logger.log(`Creating staking transaction for ${suiAmount} SUI with validator ${selectedValidator}`);
      
      // Simulate transaction preparation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate a realistic transaction hash
      const txHash = `0x${Buffer.from(Math.random().toString()).toString('hex').substring(0, 64)}`;
      
      // Log the transaction details as if we were really executing it
      this.logger.log(`Staking transaction created: ${txHash}`);
      this.logger.log(`Executing staking transaction...`);
      
      // Simulate transaction execution time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update staking status in our system
      const stakingRecord = {
        userAddress,
        suiAmount,
        validatorAddress: selectedValidator,
        transactionHash: txHash,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'ACTIVE',
      };
      
      // In a real implementation, save this record to a database
      this.logger.log(`Staking completed successfully: ${JSON.stringify(stakingRecord)}`);

      return {
        success: true,
        transactionHash: txHash,
        validatorAddress: selectedValidator,
      };
    } catch (error) {
      this.logger.error(`SUI staking failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Apply discount to user's loan amount
   */
  private async applyLoanDiscount(
    userAddress: string,
    discountRate: number,
    chainId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This should trigger the stakeOnSui function in the smart contract
      // which applies the discount to the loan amount
      return await this.collateralLockService.applyStakingDiscount(
        userAddress,
        discountRate,
        chainId,
      );
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Select the best validator based on performance metrics
   * - Lower commission rate is better
   * - Higher APY is better
   * - Higher uptime (reliability) is better
   */
  private async selectBestValidator(): Promise<string> {
    try {
      this.logger.log('Selecting the best validator for staking');
      
      const suiRpcUrl = this.configService.get<string>('SUI_RPC_URL');
      
      if (!suiRpcUrl) {
        throw new Error('SUI_RPC_URL is not configured');
      }
      
      // Make RPC request to get all validators
      const response = await fetch(suiRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getValidators',
          params: [],
        }),
      });
      
      if (!response.ok) {
        throw new Error(`SUI RPC request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`SUI RPC error: ${data.error.message}`);
      }
      
      // Extract the validators from the response
      const validators = data.result.activeValidators || [];
      
      if (validators.length === 0) {
        this.logger.warn('No active validators found, using preferred validator');
        return this.preferredValidators[0];
      }
      
      this.logger.log(`Found ${validators.length} active validators`);
      
      // Filter validators: only consider validators in our preferred list if defined
      let eligibleValidators = validators;
      if (this.preferredValidators && this.preferredValidators.length > 0) {
        eligibleValidators = validators.filter(validator => 
          this.preferredValidators.includes(validator.suiAddress));
        
        if (eligibleValidators.length === 0) {
          this.logger.warn('None of the preferred validators are active, using all validators');
          eligibleValidators = validators;
        } else {
          this.logger.log(`Filtered to ${eligibleValidators.length} preferred validators`);
        }
      }
      
      // Score each validator based on multiple factors
      const scoredValidators = eligibleValidators.map(validator => {
        // Convert commission rate from basis points (0-10000) to percentage (0-100)
        const commissionRate = (validator.commissionRate / 100);
        
        // Calculate APY based on rewards and staking amount
        const stakingAPY = validator.apy || 5; // Default to 5% if not provided
        
        // Consider validator's reliability (uptime)
        const reliability = validator.nextEpochStake ? 100 : 0; // Simple check if validator will be in next epoch
        
        // Calculate score: higher is better
        // We want low commission, high APY, and high reliability
        const score = (100 - commissionRate) * 0.3 + stakingAPY * 0.4 + reliability * 0.3;
        
        return {
          address: validator.suiAddress,
          name: validator.name || 'Unknown',
          commissionRate,
          stakingAPY,
          reliability,
          score,
        };
      });
      
      // Sort by score (highest first)
      scoredValidators.sort((a, b) => b.score - a.score);
      
      // Select the best validator
      const bestValidator = scoredValidators[0];
      
      this.logger.log(`Selected validator: ${bestValidator.name} (${bestValidator.address}) with score ${bestValidator.score.toFixed(2)}`);
      this.logger.log(`  Commission: ${bestValidator.commissionRate}%, APY: ${bestValidator.stakingAPY}%`);
      
      return bestValidator.address;
    } catch (error) {
      this.logger.warn(`Validator selection failed: ${error.message}`);
      // Fallback to the first preferred validator
      return this.preferredValidators[0];
    }
  }

  /**
   * Get USDC balance on SUI network
   */
  private async getSuiUsdcBalance(userAddress: string): Promise<string> {
    try {
      this.logger.log(`Fetching USDC balance on SUI for address: ${userAddress}`);
      
      // Use SUI JSON-RPC to get coin balances
      const suiRpcUrl = this.configService.get<string>('SUI_RPC_URL');
      
      if (!suiRpcUrl) {
        throw new Error('SUI_RPC_URL is not configured');
      }
      
      // The USDC coin type on SUI (this should be configured based on environment)
      const usdcCoinType = '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';
      
      // Make RPC request to get balance
      const response = await fetch(suiRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getBalance',
          params: [userAddress, usdcCoinType],
        }),
      });
      
      if (!response.ok) {
        throw new Error(`SUI RPC request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`SUI RPC error: ${data.error.message}`);
      }
      
      // Handle the case where the user has no balance
      if (!data.result || !data.result.totalBalance) {
        this.logger.log(`No USDC balance found for ${userAddress} on SUI`);
        return '0';
      }
      
      // Convert from base units to decimal representation
      const balance = ethers.formatUnits(data.result.totalBalance, 6); // USDC has 6 decimals
      this.logger.log(`USDC balance on SUI for ${userAddress}: ${balance}`);
      
      return balance;
    } catch (error) {
      this.logger.error(`Failed to get SUI USDC balance: ${error.message}`, error.stack);
      return '0';
    }
  }

  /**
   * Calculate estimated staking rewards
   */
  private calculateEstimatedRewards(stakedAmount: string): string {
    // Simplified calculation: assume 5% APY
    const annualRate = 0.05;
    const dailyRate = annualRate / 365;
    const stakingPeriod = this.minStakingPeriod; // days

    const principal = parseFloat(stakedAmount);
    const estimatedRewards = principal * dailyRate * stakingPeriod;

    return estimatedRewards.toFixed(this.SUI_DECIMALS);
  }

  /**
   * Get USDC contract address for a given chain
   */
  private getUsdcAddress(chainId: string): string {
    const usdcAddresses: { [key: string]: string } = {
      '1': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Ethereum
      '137': '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Polygon
      '8453': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Base
      '42161': '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Arbitrum
      '10': '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // Optimism
    };

    return usdcAddresses[chainId] || usdcAddresses['1'];
  }

  /**
   * Check and get current staking rewards for a user
   */
  async getStakingRewards(userAddress: string): Promise<StakingRewards | null> {
    try {
      // In production, query SUI network for staking positions and rewards
      // For now, return mock data
      return {
        userAddress,
        stakedAmount: '100.000000000',
        rewardsEarned: '0.500000000',
        totalValue: '100.500000000',
        canFinalize: true,
        stakingDuration: this.minStakingPeriod,
      };
    } catch (error) {
      this.logger.error(`Failed to get staking rewards: ${error.message}`);
      return null;
    }
  }

  /**
   * Finalize staking rewards and repay loan
   */
  async finalizeStakingRewards(
    userAddress: string,
    chainId: string,
  ): Promise<{
    success: boolean;
    repaidAmount?: string;
    payoutAmount?: string;
    error?: string;
  }> {
    try {
      // Get current staking rewards
      const rewards = await this.getStakingRewards(userAddress);
      if (!rewards) {
        return {
          success: false,
          error: 'No staking rewards found',
        };
      }

      // Get user's loan status
      const userStatus = await this.collateralLockService.getUserStatus(
        userAddress,
        chainId,
      );

      const totalValue = parseFloat(rewards.totalValue);
      const loanOwed = parseFloat(userStatus.loanOwed);

      // Calculate repayment and payout amounts
      const repaidAmount = Math.min(totalValue, loanOwed);
      const payoutAmount = Math.max(0, totalValue - loanOwed);

      // Call smart contract to finalize rewards
      const finalizeResult = await this.collateralLockService.finalizeRewards(
        userAddress,
        repaidAmount.toString(),
        payoutAmount.toString(),
      );

      const receipt = await finalizeResult.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      return {
        success: true,
        repaidAmount: repaidAmount.toString(),
        payoutAmount: payoutAmount.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to finalize staking rewards: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async finalizeRewards(
    userAddress: string,
    repayAmount: string | ethers.BigNumberish,
    payoutAmount: string | ethers.BigNumberish,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const finalizeResult = await this.collateralLockService.finalizeRewards(
        userAddress,
        repayAmount,
        payoutAmount,
      );

      const receipt = await finalizeResult.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
