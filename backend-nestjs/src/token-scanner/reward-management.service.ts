import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ethers } from 'ethers';
import { SuiStakingService, StakingRewards } from './sui-staking.service';
import { CollateralLockService } from './collateral-lock.service';
import { firstValueFrom } from 'rxjs';

export interface RewardCheckResult {
  userAddress: string;
  hasRewards: boolean;
  stakingRewards?: StakingRewards;
  canFinalize: boolean;
  estimatedPayout: string;
  estimatedRepayment: string;
}

export interface RewardFinalizationResult {
  success: boolean;
  transactionHash?: string;
  repaidAmount?: string;
  payoutAmount?: string;
  finalizedAt?: number;
  error?: string;
}

export interface VAA {
  version: number;
  guardianSetIndex: number;
  signatures: string[];
  timestamp: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: string;
  sequence: string;
  consistencyLevel: number;
  payload: string;
}

export interface WormholeMessage {
  id: string;
  emitterChain: number;
  emitterAddress: string;
  sequence: string;
  vaa?: VAA;
  status: 'pending' | 'completed' | 'failed';
}

interface LoanStatus {
  collateral: string;
  loanOwed: string;
  hasActiveLoan: boolean;
}

@Injectable()
export class RewardManagementService {
  private readonly logger = new Logger(RewardManagementService.name);
  private readonly wormholeApiUrl = 'https://api.wormholescan.io';
  private readonly suiRpcUrl: string;
  private readonly checkInterval = 60000; // 1 minute
  private readonly maxRetries = 10;

  // Active monitoring for users
  private readonly activeMonitoring = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly suiStakingService: SuiStakingService,
    private readonly collateralLockService: CollateralLockService,
  ) {
    this.suiRpcUrl = this.configService.get<string>(
      'SUI_RPC_URL',
      'https://fullnode.mainnet.sui.io:443',
    );
  }

  /**
   * Check if a user has rewards ready for finalization
   */
  async checkRewardsStatus(userAddress: string): Promise<RewardCheckResult> {
    try {
      this.logger.log(`Checking rewards status for user: ${userAddress}`);

      // Get staking rewards from SUI network
      const stakingRewards =
        await this.suiStakingService.getStakingRewards(userAddress);

      if (!stakingRewards) {
        return {
          userAddress,
          hasRewards: false,
          canFinalize: false,
          estimatedPayout: '0',
          estimatedRepayment: '0',
        };
      }

      // Get user's loan status from all supported chains
      const loanStatus = await this.getUserLoanStatusAllChains(userAddress);

      // Calculate estimated repayment and payout
      const totalRewardValue = parseFloat(stakingRewards.totalValue);
      const totalLoanOwed = loanStatus.reduce(
        (sum, status) => sum + parseFloat(status.loanOwed),
        0,
      );

      const estimatedRepayment = Math.min(totalRewardValue, totalLoanOwed);
      const estimatedPayout = Math.max(0, totalRewardValue - totalLoanOwed);

      return {
        userAddress,
        hasRewards: true,
        stakingRewards,
        canFinalize: stakingRewards.canFinalize && totalRewardValue > 0,
        estimatedPayout: estimatedPayout.toFixed(6),
        estimatedRepayment: estimatedRepayment.toFixed(6),
      };
    } catch (error) {
      this.logger.error(`Failed to check rewards status: ${error.message}`);
      return {
        userAddress,
        hasRewards: false,
        canFinalize: false,
        estimatedPayout: '0',
        estimatedRepayment: '0',
      };
    }
  }

  /**
   * Finalize rewards for a user
   * This includes claiming SUI staking rewards, bridging back to source chain,
   * and repaying the loan through the smart contract
   */
  async finalizeRewards(
    userAddress: string,
    sourceChainId: string,
  ): Promise<RewardFinalizationResult> {
    try {
      this.logger.log(`Finalizing rewards for user: ${userAddress}`);

      // Step 1: Check if rewards are ready
      const rewardStatus = await this.checkRewardsStatus(userAddress);
      if (!rewardStatus.canFinalize) {
        return {
          success: false,
          error: 'Rewards are not ready for finalization',
        };
      }

      // Step 2: Claim staking rewards on SUI
      const claimResult = await this.claimSuiStakingRewards(userAddress);
      if (!claimResult.success) {
        return {
          success: false,
          error: `Failed to claim SUI rewards: ${claimResult.error}`,
        };
      }

      // Step 3: Convert SUI rewards to USDC on SUI network
      const swapResult = await this.swapSuiToUsdc(
        claimResult.claimedAmount!,
        userAddress,
      );
      if (!swapResult.success) {
        return {
          success: false,
          error: `Failed to swap SUI to USDC: ${swapResult.error}`,
        };
      }

      // Step 4: Bridge USDC back to source chain
      const bridgeResult = await this.bridgeUsdcToSourceChain(
        swapResult.usdcAmount!,
        sourceChainId,
        userAddress,
      );
      if (!bridgeResult.success) {
        return {
          success: false,
          error: `Failed to bridge USDC: ${bridgeResult.error}`,
        };
      }

      // Step 5: Wait for bridge completion and get VAA proof
      const vaaProof = await this.waitForVAAProof(
        bridgeResult.wormholeSequence!,
        'SUI',
      );
      if (!vaaProof) {
        return {
          success: false,
          error: 'Failed to get VAA proof for bridge transaction',
        };
      }

      // Step 6: Finalize rewards in smart contract
      try {
        const finalizeResult = await this.collateralLockService.finalizeRewards(
          userAddress,
          rewardStatus.estimatedRepayment,
          rewardStatus.estimatedPayout,
        );

        const receipt = await finalizeResult.wait();
        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }

        this.logger.log(
          `Rewards finalized successfully for user: ${userAddress}`,
        );

        return {
          success: true,
          transactionHash: receipt.hash,
          repaidAmount: rewardStatus.estimatedRepayment,
          payoutAmount: rewardStatus.estimatedPayout,
          finalizedAt: Date.now(),
        };
      } catch (error) {
        return {
          success: false,
          error: `Smart contract finalization failed: ${error.message}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Reward finalization failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Start automatic monitoring for a user's rewards
   */
  startRewardMonitoring(userAddress: string, sourceChainId: string): void {
    // Stop existing monitoring if any
    this.stopRewardMonitoring(userAddress);

    this.logger.log(`Starting reward monitoring for user: ${userAddress}`);

    const monitoringInterval = setInterval(async () => {
      try {
        const rewardStatus = await this.checkRewardsStatus(userAddress);

        if (rewardStatus.canFinalize) {
          this.logger.log(
            `Rewards ready for finalization for user: ${userAddress}`,
          );

          // Automatically finalize rewards
          const finalizeResult = await this.finalizeRewards(
            userAddress,
            sourceChainId,
          );

          if (finalizeResult.success) {
            this.logger.log(`Auto-finalized rewards for user: ${userAddress}`);
            this.stopRewardMonitoring(userAddress);
          } else {
            this.logger.warn(
              `Auto-finalization failed for user: ${userAddress}: ${finalizeResult.error}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Reward monitoring error for user ${userAddress}: ${error.message}`,
        );
      }
    }, this.checkInterval);

    this.activeMonitoring.set(userAddress, monitoringInterval);
  }

  /**
   * Stop automatic monitoring for a user
   */
  stopRewardMonitoring(userAddress: string): void {
    const interval = this.activeMonitoring.get(userAddress);
    if (interval) {
      clearInterval(interval);
      this.activeMonitoring.delete(userAddress);
      this.logger.log(`Stopped reward monitoring for user: ${userAddress}`);
    }
  }

  /**
   * Claim staking rewards on SUI network
   */
  private async claimSuiStakingRewards(
    userAddress: string,
  ): Promise<{ success: boolean; claimedAmount?: string; error?: string }> {
    try {
      // In production, use SUI SDK to claim staking rewards
      // For now, simulate the claim
      const mockClaimedAmount = '5.000000000'; // 5 SUI rewards

      this.logger.log(
        `Claimed ${mockClaimedAmount} SUI rewards for user: ${userAddress}`,
      );

      return {
        success: true,
        claimedAmount: mockClaimedAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Swap SUI to USDC on SUI network
   */
  private async swapSuiToUsdc(
    suiAmount: string,
    userAddress: string,
  ): Promise<{ success: boolean; usdcAmount?: string; error?: string }> {
    try {
      // In production, integrate with SUI DEX for SUI -> USDC swap
      // For now, simulate the swap
      const suiPrice = 2.0; // $2 per SUI
      const usdcAmount = (parseFloat(suiAmount) * suiPrice).toFixed(6);

      this.logger.log(
        `Swapped ${suiAmount} SUI to ${usdcAmount} USDC for user: ${userAddress}`,
      );

      return {
        success: true,
        usdcAmount,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bridge USDC from SUI back to source chain
   */
  private async bridgeUsdcToSourceChain(
    usdcAmount: string,
    targetChainId: string,
    userAddress: string,
  ): Promise<{ success: boolean; wormholeSequence?: string; error?: string }> {
    try {
      // In production, use Wormhole SDK to bridge USDC
      // For now, simulate the bridge
      const mockSequence = Math.floor(Math.random() * 1000000).toString();

      this.logger.log(
        `Bridged ${usdcAmount} USDC from SUI to chain ${targetChainId} for user: ${userAddress}`,
      );

      return {
        success: true,
        wormholeSequence: mockSequence,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Wait for Wormhole VAA proof
   */
  private async waitForVAAProof(
    sequence: string,
    sourceChain: string,
  ): Promise<VAA | null> {
    const maxWaitTime = 20 * 60 * 1000; // 20 minutes
    const checkInterval = 30 * 1000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(
            `${this.wormholeApiUrl}/api/v1/vaas/${sourceChain}/${sequence}`,
          ),
        );

        if (response.data && response.data.vaa) {
          this.logger.log(`VAA proof received for sequence: ${sequence}`);
          return response.data.vaa;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        this.logger.warn(`Error checking VAA status: ${error.message}`);
      }
    }

    this.logger.error(`VAA proof timeout for sequence: ${sequence}`);
    return null;
  }

  /**
   * Get user's loan status from all supported chains
   */
  private async getUserLoanStatusAllChains(
    userAddress: string,
  ): Promise<LoanStatus[]> {
    try {
      const loanStatuses: LoanStatus[] = [];

      // Get loan status from Ethereum
      const ethStatus = await this.collateralLockService.getUserStatus(
        userAddress,
        '1', // Ethereum chain ID
      );
      loanStatuses.push(ethStatus);

      // Get loan status from Polygon
      const polyStatus = await this.collateralLockService.getUserStatus(
        userAddress,
        '137', // Polygon chain ID
      );
      loanStatuses.push(polyStatus);

      return loanStatuses;
    } catch (error) {
      this.logger.error(`Failed to get loan status: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all users with active monitoring
   */
  getActiveMonitoringUsers(): string[] {
    return Array.from(this.activeMonitoring.keys());
  }

  /**
   * Clean up all monitoring intervals
   */
  onModuleDestroy() {
    this.activeMonitoring.forEach((interval, userAddress) => {
      clearInterval(interval);
      this.logger.log(`Cleaned up monitoring for user: ${userAddress}`);
    });
    this.activeMonitoring.clear();
  }
}
