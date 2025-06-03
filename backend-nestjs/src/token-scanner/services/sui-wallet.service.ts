import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { StakingPosition, StakingStatus } from '../entities/staking-position.entity';

interface WalletBalance {
  address: string;
  balances: {
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    decimals: number;
  }[];
}

interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
  status: TransactionStatus;
  transactionHash: string;
  timestamp: Date;
}

interface WalletLoan {
  id: string;
  collateralAmount: string;
  collateralTokenSymbol: string;
  loanAmount: string;
  loanTokenSymbol: string;
  status: LoanStatus;
  createdAt: Date;
}

interface WalletStakingPosition {
  id: string;
  validatorAddress: string;
  stakedAmount: string;
  accruedRewards: string;
  status: StakingStatus;
  stakingStartTime: Date;
  stakingEndTime: Date;
}

@Injectable()
export class SuiWalletService {
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

  async getWalletBalance(walletAddress: string): Promise<WalletBalance> {
    try {
      // Call Sui wallet API
      const response = await fetch(`${this.suiRpcUrl}/wallet/${walletAddress}/balance`);
      
      if (!response.ok) {
        throw new Error(`Failed to get wallet balance: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        address: walletAddress,
        balances: data.balances.map((balance: any) => ({
          tokenAddress: balance.tokenAddress,
          tokenSymbol: balance.tokenSymbol,
          amount: balance.amount,
          decimals: balance.decimals,
        })),
      };
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      throw error;
    }
  }

  async getWalletTransactions(walletAddress: string): Promise<WalletTransaction[]> {
    try {
      // Get transactions from database
      const transactions = await this.databaseService.getTransactionsByWalletAddress(walletAddress);
      return transactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        tokenAddress: transaction.tokenAddress,
        tokenSymbol: transaction.tokenSymbol,
        status: transaction.status,
        transactionHash: transaction.transactionHash,
        timestamp: transaction.createdAt,
      }));
    } catch (error) {
      console.error('Error getting wallet transactions:', error);
      throw error;
    }
  }

  async getWalletLoans(walletAddress: string): Promise<WalletLoan[]> {
    try {
      // Get loans from database
      const loans = await this.databaseService.getLoansByWalletAddress(walletAddress);
      return loans.map(loan => ({
        id: loan.id,
        collateralAmount: loan.collateralAmount,
        collateralTokenSymbol: loan.collateralTokenSymbol,
        loanAmount: loan.loanAmount,
        loanTokenSymbol: loan.loanTokenSymbol,
        status: loan.status,
        createdAt: loan.createdAt,
      }));
    } catch (error) {
      console.error('Error getting wallet loans:', error);
      throw error;
    }
  }

  async getWalletStakingPositions(walletAddress: string): Promise<WalletStakingPosition[]> {
    try {
      // Get staking positions from database
      const stakingPositions = await this.databaseService.getStakingPositionsByWalletAddress(walletAddress);
      return stakingPositions.map(position => ({
        id: position.id,
        validatorAddress: position.validatorAddress,
        stakedAmount: position.stakedAmount,
        accruedRewards: position.accruedRewards,
        status: position.status,
        stakingStartTime: position.stakingStartTime,
        stakingEndTime: position.stakingEndTime,
      }));
    } catch (error) {
      console.error('Error getting wallet staking positions:', error);
      throw error;
    }
  }
} 