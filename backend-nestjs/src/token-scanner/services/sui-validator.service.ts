import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { StakingPosition, StakingStatus } from '../entities/staking-position.entity';

interface ValidatorInfo {
  address: string;
  name: string;
  description: string;
  imageUrl: string;
  commissionRate: string;
  totalStaked: string;
  totalDelegators: number;
  apy: string;
  isActive: boolean;
}

interface ValidatorStats {
  totalStaked: string;
  totalDelegators: number;
  totalRewards: string;
  averageStake: string;
  minStake: string;
  maxStake: string;
  commissionRate: string;
  apy: string;
}

interface ValidatorDelegation {
  delegatorAddress: string;
  stakedAmount: string;
  stakingStartTime: Date;
  stakingEndTime: Date;
  status: StakingStatus;
  rewards: string;
}

interface ValidatorRewards {
  totalRewards: string;
  rewardsPerEpoch: string;
  lastRewardEpoch: number;
  apy: string;
}

@Injectable()
export class SuiValidatorService {
  private suiRpcUrl: string;
  private suiPrivateKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.suiRpcUrl = this.configService.get<string>('SUI_RPC_URL') || '';
    this.suiPrivateKey = this.configService.get<string>('SUI_PRIVATE_KEY') || '';

    if (!this.suiRpcUrl || !this.suiPrivateKey) {
      throw new Error('Missing required configuration: SUI_RPC_URL or SUI_PRIVATE_KEY');
    }
  }

  async getValidators(): Promise<ValidatorInfo[]> {
    try {
      // Call Sui validator API
      const response = await fetch(`${this.suiRpcUrl}/validators`);
      
      if (!response.ok) {
        throw new Error(`Failed to get validators: ${response.statusText}`);
      }

      const data = await response.json();
      return data.validators.map((validator: any) => ({
        address: validator.address,
        name: validator.name,
        description: validator.description,
        imageUrl: validator.imageUrl,
        commissionRate: validator.commissionRate,
        totalStaked: validator.totalStaked,
        totalDelegators: validator.totalDelegators,
        apy: validator.apy,
        isActive: validator.isActive,
      }));
    } catch (error) {
      console.error('Error getting validators:', error);
      throw error;
    }
  }

  async getValidatorStats(validatorAddress: string): Promise<ValidatorStats> {
    try {
      // Call Sui validator API
      const response = await fetch(`${this.suiRpcUrl}/validators/${validatorAddress}/stats`);
      
      if (!response.ok) {
        throw new Error(`Failed to get validator stats: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        totalStaked: data.totalStaked,
        totalDelegators: data.totalDelegators,
        totalRewards: data.totalRewards,
        averageStake: data.averageStake,
        minStake: data.minStake,
        maxStake: data.maxStake,
        commissionRate: data.commissionRate,
        apy: data.apy,
      };
    } catch (error) {
      console.error('Error getting validator stats:', error);
      throw error;
    }
  }

  async getValidatorDelegations(validatorAddress: string): Promise<ValidatorDelegation[]> {
    try {
      // Call Sui validator API
      const response = await fetch(`${this.suiRpcUrl}/validators/${validatorAddress}/delegations`);
      
      if (!response.ok) {
        throw new Error(`Failed to get validator delegations: ${response.statusText}`);
      }

      const data = await response.json();
      return data.delegations.map((delegation: any) => ({
        delegatorAddress: delegation.delegatorAddress,
        stakedAmount: delegation.stakedAmount,
        stakingStartTime: new Date(delegation.stakingStartTime),
        stakingEndTime: new Date(delegation.stakingEndTime),
        status: delegation.status,
        rewards: delegation.rewards,
      }));
    } catch (error) {
      console.error('Error getting validator delegations:', error);
      throw error;
    }
  }

  async getValidatorRewards(validatorAddress: string): Promise<ValidatorRewards> {
    try {
      // Call Sui validator API
      const response = await fetch(`${this.suiRpcUrl}/validators/${validatorAddress}/rewards`);
      
      if (!response.ok) {
        throw new Error(`Failed to get validator rewards: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        totalRewards: data.totalRewards,
        rewardsPerEpoch: data.rewardsPerEpoch,
        lastRewardEpoch: data.lastRewardEpoch,
        apy: data.apy,
      };
    } catch (error) {
      console.error('Error getting validator rewards:', error);
      throw error;
    }
  }

  async getValidatorStakingPositions(validatorAddress: string): Promise<StakingPosition[]> {
    try {
      // Get all staking positions from database
      const stakingPositions = await this.databaseService.getStakingPositionsByValidatorAddress(validatorAddress);
      return stakingPositions;
    } catch (error) {
      console.error('Error getting validator staking positions:', error);
      throw error;
    }
  }

  async getValidatorTransactions(validatorAddress: string): Promise<Transaction[]> {
    try {
      // Get all transactions related to this validator
      const stakingPositions = await this.databaseService.getStakingPositionsByValidatorAddress(validatorAddress);
      const transactions: Transaction[] = [];

      for (const position of stakingPositions) {
        const positionTransactions = await this.databaseService.getTransactionsByStakingPositionId(position.id);
        transactions.push(...positionTransactions);
      }

      return transactions;
    } catch (error) {
      console.error('Error getting validator transactions:', error);
      throw error;
    }
  }
}