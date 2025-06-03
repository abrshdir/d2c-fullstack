import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';

interface SwapQuoteRequest {
  sourceTokenAddress: string;
  targetTokenAddress: string;
  amount: string;
  sourceChainId: string;
  targetChainId: string;
}

interface SwapQuote {
  sourceToken: {
    address: string;
    symbol: string;
  };
  targetToken: {
    address: string;
    symbol: string;
  };
  amountIn: string;
  amountOut: string;
  gasCost: string;
  gasCostUsd: string;
  validUntil: number;
}

interface SwapRequest {
  loanId: string;
  sourceTokenAddress: string;
  targetTokenAddress: string;
  amount: string;
  minAmountOut: string;
  sourceChainId: string;
  targetChainId: string;
}

interface SwapResult {
  transactionHash: string;
  amountOut: string;
}

@Injectable()
export class SuiSwapService {
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

  async getSwapQuote(request: SwapQuoteRequest): Promise<SwapQuote> {
    try {
      // Call Sui swap API
      const response = await fetch(`${this.suiRpcUrl}/swap/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceTokenAddress: request.sourceTokenAddress,
          targetTokenAddress: request.targetTokenAddress,
          amount: request.amount,
          sourceChainId: request.sourceChainId,
          targetChainId: request.targetChainId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get swap quote: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        sourceToken: {
          address: data.sourceToken.address,
          symbol: data.sourceToken.symbol,
        },
        targetToken: {
          address: data.targetToken.address,
          symbol: data.targetToken.symbol,
        },
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        gasCost: data.gasCost,
        gasCostUsd: data.gasCostUsd,
        validUntil: data.validUntil,
      };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw error;
    }
  }

  async executeSwap(request: SwapRequest): Promise<SwapResult> {
    try {
      // Get loan details
      const loan = await this.databaseService.getLoanById(request.loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.status !== LoanStatus.ACTIVE) {
        throw new Error('Loan is not in active state');
      }

      // Create transaction record
      const transaction = await this.databaseService.createTransaction({
        loanId: request.loanId,
        walletAddress: loan.walletAddress,
        type: TransactionType.SWAP,
        amount: request.amount,
        tokenAddress: request.sourceTokenAddress,
        tokenSymbol: loan.collateralTokenSymbol,
        status: TransactionStatus.PENDING,
        details: {
          targetTokenAddress: request.targetTokenAddress,
          minAmountOut: request.minAmountOut,
          sourceChainId: request.sourceChainId,
          targetChainId: request.targetChainId,
        },
      });

      // Get swap quote
      const quote = await this.getSwapQuote({
        sourceTokenAddress: request.sourceTokenAddress,
        targetTokenAddress: request.targetTokenAddress,
        amount: request.amount,
        sourceChainId: request.sourceChainId,
        targetChainId: request.targetChainId,
      });

      // Execute swap via Sui API
      const response = await fetch(`${this.suiRpcUrl}/swap/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceTokenAddress: request.sourceTokenAddress,
          targetTokenAddress: request.targetTokenAddress,
          amount: request.amount,
          minAmountOut: request.minAmountOut,
          sourceChainId: request.sourceChainId,
          targetChainId: request.targetChainId,
          quote: quote,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute swap: ${response.statusText}`);
      }

      const data = await response.json();

      // Update transaction
      transaction.transactionHash = data.transactionHash;
      transaction.status = TransactionStatus.CONFIRMED;
      transaction.details = {
        ...transaction.details,
        quote: quote,
        amountOut: data.amountOut,
      };
      await this.databaseService.updateTransaction(transaction.id, transaction);

      // Update loan status
      loan.status = LoanStatus.ACTIVE;
      loan.swapTransactionHash = data.transactionHash;
      loan.swappedAmount = data.amountOut;
      loan.swappedTokenAddress = request.targetTokenAddress;
      loan.swappedTokenSymbol = quote.targetToken.symbol;
      await this.databaseService.updateLoan(loan.id, loan);

      return {
        transactionHash: data.transactionHash,
        amountOut: data.amountOut,
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  async getSwapTransactions(walletAddress: string): Promise<Transaction[]> {
    return await this.databaseService.getTransactionsByWalletAddressAndType(
      walletAddress,
      TransactionType.SWAP,
    );
  }

  async estimateSwapGas(
    sourceTokenAddress: string,
    targetTokenAddress: string,
    amount: string,
    sourceChainId: string,
    targetChainId: string,
  ): Promise<{ gasCost: string; gasCostUsd: string }> {
    try {
      // Get current gas price
      const response = await fetch(`${this.suiRpcUrl}/gas/price`);
      if (!response.ok) {
        throw new Error(`Failed to get gas price: ${response.statusText}`);
      }

      const data = await response.json();
      const gasPrice = data.gasPrice;
      const estimatedGas = '300000'; // 300,000 gas units

      // Calculate gas cost in native token
      const gasCost = (BigInt(gasPrice) * BigInt(estimatedGas)).toString();

      // Get native token price in USD
      const priceResponse = await fetch(`${this.suiRpcUrl}/token/price/${sourceChainId}`);
      if (!priceResponse.ok) {
        throw new Error(`Failed to get token price: ${priceResponse.statusText}`);
      }

      const priceData = await priceResponse.json();
      const tokenPriceUsd = priceData.price;

      // Calculate gas cost in USD
      const gasCostUsd = (
        parseFloat(gasCost) * tokenPriceUsd
      ).toString();

      return {
        gasCost,
        gasCostUsd,
      };
    } catch (error) {
      console.error('Error estimating swap gas:', error);
      throw error;
    }
  }
} 