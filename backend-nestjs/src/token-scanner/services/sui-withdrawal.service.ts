import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { StakingPosition, StakingStatus } from '../entities/staking-position.entity';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';

interface WithdrawalRequest {
  loanId: string;
  walletAddress: string;
  stakedAmount: string;
  accruedRewards: string;
  validatorAddress: string;
}

interface WithdrawalResult {
  withdrawalId: string;
  status: WithdrawalStatus;
  transactionHash: string;
}

interface FinalizeRequest {
  withdrawalId: string;
  walletAddress: string;
}

interface FinalizeResult {
  status: WithdrawalStatus;
  transactionHash: string;
}

@Injectable()
export class SuiWithdrawalService {
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

  async initiateWithdrawal(request: WithdrawalRequest): Promise<WithdrawalResult> {
    try {
      // Get loan and validate status
      const loan = await this.databaseService.getLoanById(request.loanId);
      if (loan.status !== LoanStatus.STAKING) {
        throw new Error('Loan is not in staking status');
      }

      // Create withdrawal record
      const withdrawal = await this.databaseService.createWithdrawal({
        loanId: request.loanId,
        walletAddress: request.walletAddress,
        stakedAmount: request.stakedAmount,
        accruedRewards: request.accruedRewards,
        accruedAmount: '0',
        totalAmount: request.stakedAmount,
        status: WithdrawalStatus.PENDING,
      });

      // Create transaction record
      const transaction = await this.databaseService.createTransaction({
        loanId: request.loanId,
        walletAddress: request.walletAddress,
        type: TransactionType.INITIATE_WITHDRAWAL,
        amount: request.stakedAmount,
        tokenAddress: loan.collateralTokenAddress,
        tokenSymbol: loan.collateralTokenSymbol,
        status: TransactionStatus.PENDING,
        details: {
          withdrawalId: withdrawal.id,
          validatorAddress: request.validatorAddress,
        },
      });

      // Call Sui withdrawal API
      const response = await fetch(`${this.suiRpcUrl}/withdrawals/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          walletAddress: request.walletAddress,
          stakedAmount: request.stakedAmount,
          validatorAddress: request.validatorAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to initiate withdrawal: ${response.statusText}`);
      }

      const data = await response.json();

      // Update transaction with hash
      await this.databaseService.updateTransaction(transaction.id, {
        transactionHash: data.transactionHash,
        status: TransactionStatus.CONFIRMED,
      });

      // Update withdrawal status
      await this.databaseService.updateWithdrawal(withdrawal.id, {
        status: WithdrawalStatus.UNSTAKING,
        unstakingTransactionHash: data.transactionHash,
      });

      // Update loan status
      await this.databaseService.updateLoan(request.loanId, {
        status: LoanStatus.WITHDRAWING,
      });

      return {
        withdrawalId: withdrawal.id,
        status: WithdrawalStatus.UNSTAKING,
        transactionHash: data.transactionHash,
      };
    } catch (error) {
      console.error('Error initiating withdrawal:', error);
      throw error;
    }
  }

  async finalizeWithdrawal(request: FinalizeRequest): Promise<FinalizeResult> {
    try {
      // Get withdrawal record
      const withdrawal = await this.databaseService.getWithdrawalById(request.withdrawalId);

      // Create transaction record
      const transaction = await this.databaseService.createTransaction({
        loanId: withdrawal.loanId,
        walletAddress: request.walletAddress,
        type: TransactionType.FINALIZE_WITHDRAWAL,
        amount: withdrawal.totalAmount,
        tokenAddress: '', // Will be updated after swap
        tokenSymbol: '', // Will be updated after swap
        status: TransactionStatus.PENDING,
        details: {
          withdrawalId: withdrawal.id,
        },
      });

      // Call Sui withdrawal API
      const response = await fetch(`${this.suiRpcUrl}/withdrawals/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          walletAddress: request.walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to finalize withdrawal: ${response.statusText}`);
      }

      const data = await response.json();

      // Update transaction with hash
      await this.databaseService.updateTransaction(transaction.id, {
        transactionHash: data.transactionHash,
        status: TransactionStatus.CONFIRMED,
      });

      // Update withdrawal status
      await this.databaseService.updateWithdrawal(withdrawal.id, {
        status: WithdrawalStatus.COMPLETED,
        finalizeTransactionHash: data.transactionHash,
      });

      // Update loan status
      const loan = await this.databaseService.getLoanById(withdrawal.loanId);
      await this.databaseService.updateLoan(withdrawal.loanId, {
        status: LoanStatus.COMPLETED,
      });

      return {
        status: WithdrawalStatus.COMPLETED,
        transactionHash: data.transactionHash,
      };
    } catch (error) {
      console.error('Error finalizing withdrawal:', error);
      throw error;
    }
  }

  async getWithdrawalStatus(withdrawalId: string): Promise<WithdrawalStatus> {
    try {
      const withdrawal = await this.databaseService.getWithdrawalById(withdrawalId);
      return withdrawal.status;
    } catch (error) {
      console.error('Error getting withdrawal status:', error);
      throw error;
    }
  }

  async getWithdrawalDetails(withdrawalId: string): Promise<Withdrawal> {
    try {
      return await this.databaseService.getWithdrawalById(withdrawalId);
    } catch (error) {
      console.error('Error getting withdrawal details:', error);
      throw error;
    }
  }
} 