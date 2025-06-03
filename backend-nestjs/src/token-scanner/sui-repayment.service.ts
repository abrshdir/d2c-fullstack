import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwapTransactionService } from './swap-transaction.service';
import { SwapTransaction } from './swap-transaction.service';

export interface RepaymentResult {
  walletAddress: string;
  amountRepaid: string;
  remainingBalance: string;
  transactionsPaid: string[];
  timestamp: number;
  status: RepaymentStatus;
}

export enum RepaymentStatus {
  CONFIRMED = 'CONFIRMED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

@Injectable()
export class SuiRepaymentService {
  private readonly logger = new Logger(SuiRepaymentService.name);
  private repayments: RepaymentResult[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly swapTransactionService: SwapTransactionService,
  ) {}

  /**
   * Process a USDC repayment on SUI network
   * @param walletAddress The user's wallet address
   * @param bridgedAmount The amount of USDC that arrived on SUI
   * @returns RepaymentResult with details about the repayment
   */
  async processRepayment(
    walletAddress: string,
    bridgedAmount: string,
  ): Promise<RepaymentResult> {
    this.logger.log(
      `Processing repayment for wallet ${walletAddress} with amount ${bridgedAmount}`,
    );

    // Get the user's outstanding debt
    const outstandingDebt =
      this.swapTransactionService.getTotalOutstandingDebt(walletAddress);

    // Get all unpaid transactions for this wallet
    const unpaidTransactions = this.swapTransactionService
      .getTransactionsForWallet(walletAddress)
      .filter((tx) => !tx.isPaid);

    // Convert bridged amount to a number for calculations
    const bridgedAmountNum = parseFloat(bridgedAmount);

    // If no debt or no bridged amount, return failed status
    if (outstandingDebt <= 0 || bridgedAmountNum <= 0) {
      return this.createRepaymentResult(
        walletAddress,
        '0',
        bridgedAmount,
        [],
        RepaymentStatus.FAILED,
      );
    }

    // Determine how much to deduct for debt repayment
    const amountToDeduct = Math.min(outstandingDebt, bridgedAmountNum);
    const remainingBalance = (bridgedAmountNum - amountToDeduct).toFixed(6);

    // Mark transactions as paid until the debt is covered
    const paidTransactionIds: string[] = [];
    let debtCovered = 0;

    for (const tx of unpaidTransactions) {
      // Calculate this transaction's gas cost in USD
      const gasCostUsd = parseFloat(tx.gasCost) * 2000; // Simplified conversion

      // If we've covered enough debt, stop marking transactions
      if (debtCovered + gasCostUsd > amountToDeduct) {
        break;
      }

      // Mark this transaction as paid
      const success = this.swapTransactionService.markTransactionAsPaid(tx.id);
      if (success) {
        paidTransactionIds.push(tx.id);
        debtCovered += gasCostUsd;
      }
    }

    // Determine repayment status
    const status = this.determineRepaymentStatus(
      debtCovered,
      outstandingDebt,
      paidTransactionIds.length,
    );

    // Create and store the repayment result
    const repaymentResult = this.createRepaymentResult(
      walletAddress,
      debtCovered.toFixed(6),
      remainingBalance,
      paidTransactionIds,
      status,
    );

    this.repayments.push(repaymentResult);
    return repaymentResult;
  }

  /**
   * Get all repayments for a specific wallet
   */
  getRepaymentsForWallet(walletAddress: string): RepaymentResult[] {
    return this.repayments.filter(
      (repayment) =>
        repayment.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
    );
  }

  /**
   * Helper method to create a repayment result object
   */
  private createRepaymentResult(
    walletAddress: string,
    amountRepaid: string,
    remainingBalance: string,
    transactionsPaid: string[],
    status: RepaymentStatus,
  ): RepaymentResult {
    return {
      walletAddress,
      amountRepaid,
      remainingBalance,
      transactionsPaid,
      timestamp: Date.now(),
      status,
    };
  }

  /**
   * Determine the status of a repayment based on the amount covered
   */
  private determineRepaymentStatus(
    amountCovered: number,
    totalDebt: number,
    transactionsPaidCount: number,
  ): RepaymentStatus {
    if (amountCovered >= totalDebt) {
      return RepaymentStatus.CONFIRMED;
    } else if (transactionsPaidCount > 0) {
      return RepaymentStatus.PARTIAL;
    } else {
      return RepaymentStatus.FAILED;
    }
  }
}
