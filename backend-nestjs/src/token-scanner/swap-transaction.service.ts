import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwapResult } from './rubic-swap.service';

export interface SwapTransaction {
  id: string;
  walletAddress: string;
  transactionHash: string;
  tokenSymbol: string;
  tokenAddress: string;
  chainId: string;
  usdcObtained: string;
  gasCost: string;
  timestamp: number;
  isPaid: boolean;
  status?: string;
}

@Injectable()
export class SwapTransactionService {
  private readonly logger = new Logger(SwapTransactionService.name);
  private transactions: SwapTransaction[] = [];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Record a new swap transaction
   */
  recordTransaction(
    walletAddress: string,
    tokenSymbol: string,
    tokenAddress: string,
    chainId: string,
    swapResult: SwapResult,
  ): SwapTransaction {
    const transaction: SwapTransaction = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      walletAddress,
      tokenSymbol,
      tokenAddress,
      chainId,
      transactionHash: swapResult.transactionHash,
      usdcObtained: swapResult.usdcObtained,
      gasCost: swapResult.gasCost,
      timestamp: swapResult.timestamp,
      isPaid: false,
    };

    this.transactions.push(transaction);
    this.logger.log(
      `Recorded swap transaction: ${transaction.id} for wallet ${walletAddress}`,
    );

    return transaction;
  }

  /**
   * Get all transactions for a wallet
   */
  getTransactionsForWallet(walletAddress: string): SwapTransaction[] {
    console.log(`Getting transactions for wallet ${walletAddress}...`);
    return this.transactions.filter(
      (tx) => tx.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
    );
  }

  /**
   * Mark a transaction as paid
   */
  markTransactionAsPaid(transactionId: string): boolean {
    const transaction = this.transactions.find((tx) => tx.id === transactionId);

    if (!transaction) {
      return false;
    }

    transaction.isPaid = true;
    this.logger.log(`Marked transaction ${transactionId} as paid`);

    return true;
  }

  /**
   * Get total outstanding debt for a wallet
   */
  getTotalOutstandingDebt(walletAddress: string): number {
    return this.transactions
      .filter(
        (tx) =>
          tx.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
          !tx.isPaid,
      )
      .reduce((total, tx) => {
        // Convert gas cost from ETH to USD (simplified, would need price feed in production)
        const gasCostUsd = parseFloat(tx.gasCost) * 2000; // Assuming 1 ETH = $2000 for simplicity
        return total + gasCostUsd;
      }, 0);
  }

  /**
   * Track a transaction from the Rubic widget
   */
  async trackTransaction(
    walletAddress: string,
    transactionHash: string,
    status: string,
  ): Promise<boolean> {
    try {
      // Check if transaction already exists
      const existingTxIndex = this.transactions.findIndex(
        (tx) => tx.transactionHash === transactionHash,
      );

      if (existingTxIndex >= 0) {
        // Update existing transaction
        this.transactions[existingTxIndex].status = status;
        return true;
      }

      // Create new transaction record
      const newTransaction: SwapTransaction = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        walletAddress,
        transactionHash,
        tokenSymbol: 'Unknown', // Will be updated when transaction completes
        tokenAddress: 'Unknown',
        chainId: 'Unknown',
        usdcObtained: '0',
        gasCost: '0',
        timestamp: Date.now(),
        status,
        isPaid: false,
      };

      this.transactions.push(newTransaction);
      return true;
    } catch (error) {
      this.logger.error(`Failed to track transaction: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the status of a transaction
   */
  async getTransactionStatus(transactionHash: string): Promise<string> {
    const transaction = this.transactions.find(
      (tx) => tx.transactionHash === transactionHash,
    );

    if (!transaction) {
      return 'unknown';
    }

    return transaction.status || 'pending';
  }
}
