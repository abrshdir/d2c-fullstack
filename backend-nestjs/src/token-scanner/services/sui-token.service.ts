import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';

interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  balance: string;
  decimals: number;
}

interface TokenTransferRequest {
  loanId: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress: string;
  amount: string;
}

interface TokenTransferResult {
  transactionHash: string;
  amount: string;
}

@Injectable()
export class SuiTokenService {
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

  async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<TokenBalance> {
    try {
      // Call Sui token API
      const response = await fetch(`${this.suiRpcUrl}/token/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          tokenAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token balance: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol,
        balance: data.balance,
        decimals: data.decimals,
      };
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  async transferTokens(request: TokenTransferRequest): Promise<TokenTransferResult> {
    try {
      // Get loan details
      const loan = await this.databaseService.getLoanById(request.loanId);
      if (!loan) {
        throw new Error('Loan not found');
      }

      // Create transaction record
      const transaction = await this.databaseService.createTransaction({
        loanId: request.loanId,
        walletAddress: request.fromAddress,
        type: TransactionType.TRANSFER,
        amount: request.amount,
        tokenAddress: request.tokenAddress,
        status: TransactionStatus.PENDING,
        details: {
          toAddress: request.toAddress,
        },
      });

      // Call Sui token API
      const response = await fetch(`${this.suiRpcUrl}/token/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: request.fromAddress,
          toAddress: request.toAddress,
          tokenAddress: request.tokenAddress,
          amount: request.amount,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to transfer tokens: ${response.statusText}`);
      }

      const data = await response.json();

      // Update transaction
      transaction.transactionHash = data.transactionHash;
      transaction.status = TransactionStatus.CONFIRMED;
      await this.databaseService.updateTransaction(transaction.id, transaction);

      return {
        transactionHash: data.transactionHash,
        amount: request.amount,
      };
    } catch (error) {
      console.error('Error transferring tokens:', error);
      throw error;
    }
  }

  async getTokenMetadata(tokenAddress: string): Promise<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  }> {
    try {
      // Call Sui token API
      const response = await fetch(`${this.suiRpcUrl}/token/metadata/${tokenAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get token metadata: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        address: data.address,
        symbol: data.symbol,
        name: data.name,
        decimals: data.decimals,
      };
    } catch (error) {
      console.error('Error getting token metadata:', error);
      throw error;
    }
  }

  async getTokenTransactions(walletAddress: string): Promise<Transaction[]> {
    return await this.databaseService.getTransactionsByWalletAddressAndType(
      walletAddress,
      TransactionType.TRANSFER,
    );
  }
} 