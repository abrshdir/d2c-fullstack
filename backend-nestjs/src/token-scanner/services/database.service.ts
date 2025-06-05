import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionType, TransactionStatus } from '../schemas/transaction.schema';
import { Loan, LoanStatus } from '../schemas/loan.schema';
import { StakingPosition, StakingStatus } from '../schemas/staking-position.schema';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly prisma: PrismaClient;

  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<Transaction>,
    @InjectModel(Loan.name)
    private loanModel: Model<Loan>,
    @InjectModel(StakingPosition.name)
    private stakingPositionModel: Model<StakingPosition>,
  ) {
    this.prisma = new PrismaClient();
  }

  // Transaction methods
  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    const newTransaction = new this.transactionModel(transaction);
    return await newTransaction.save();
  }

  async updateTransaction(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
    const updatedTransaction = await this.transactionModel.findByIdAndUpdate(
      id,
      transaction,
      { new: true }
    );
    if (!updatedTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return updatedTransaction;
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionModel.findById(id);
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async getTransactionsByWalletAddress(walletAddress: string): Promise<Transaction[]> {
    return await this.transactionModel.find({ walletAddress }).exec();
  }

  async getTransactionsByWalletAddressAndType(
    walletAddress: string,
    type: TransactionType,
  ): Promise<Transaction[]> {
    return await this.transactionModel.find({ walletAddress, type }).exec();
  }

  async getTransactionsByStakingPositionId(stakingPositionId: string): Promise<Transaction[]> {
    return await this.transactionModel.find({ stakingPositionId }).exec();
  }

  // Loan methods
  async createLoan(loan: Partial<Loan>): Promise<Loan> {
    const newLoan = new this.loanModel(loan);
    return await newLoan.save();
  }

  async updateLoan(id: string, loan: Partial<Loan>): Promise<Loan> {
    const updatedLoan = await this.loanModel.findByIdAndUpdate(
      id,
      loan,
      { new: true }
    );
    if (!updatedLoan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return updatedLoan;
  }

  async getLoanById(id: string): Promise<Loan> {
    const loan = await this.loanModel.findById(id);
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return loan;
  }

  async getLoansByWalletAddress(walletAddress: string): Promise<Loan[]> {
    return await this.loanModel.find({ walletAddress }).exec();
  }

  // Staking position methods
  async createStakingPosition(stakingPosition: Partial<StakingPosition>): Promise<StakingPosition> {
    const newStakingPosition = new this.stakingPositionModel(stakingPosition);
    return await newStakingPosition.save();
  }

  async updateStakingPosition(
    id: string,
    stakingPosition: Partial<StakingPosition>,
  ): Promise<StakingPosition> {
    const updatedStakingPosition = await this.stakingPositionModel.findByIdAndUpdate(
      id,
      stakingPosition,
      { new: true }
    );
    if (!updatedStakingPosition) {
      throw new NotFoundException(`Staking position with ID ${id} not found`);
    }
    return updatedStakingPosition;
  }

  async getStakingPositionById(id: string): Promise<StakingPosition> {
    const stakingPosition = await this.stakingPositionModel.findById(id);
    if (!stakingPosition) {
      throw new NotFoundException(`Staking position with ID ${id} not found`);
    }
    return stakingPosition;
  }

  async getStakingPositionsByValidatorAddress(validatorAddress: string): Promise<StakingPosition[]> {
    return await this.stakingPositionModel.find({ validatorAddress }).exec();
  }

  async getStakingPositionsByWalletAddress(walletAddress: string): Promise<StakingPosition[]> {
    return await this.stakingPositionModel.find({ walletAddress }).exec();
  }

  // Gas Loan Methods
  async createGasLoan(data: {
    userAddress: string;
    tokenAmount: string;
    gasDebt: string;
    status: string;
    createdAt: Date;
    contractTxHash?: string;
  }) {
    return await this.prisma.gasLoan.create({
      data: {
        userAddress: data.userAddress,
        tokenAmount: data.tokenAmount,
        gasDebt: data.gasDebt,
        status: data.status,
        createdAt: data.createdAt,
        contractTxHash: data.contractTxHash,
      },
    });
  }

  async updateGasLoan(id: string, data: {
    status?: string;
    contractTxHash?: string;
    repaymentTxHash?: string;
    repaidAt?: Date;
    missedAt?: Date;
  }) {
    return await this.prisma.gasLoan.update({
      where: { id },
      data,
    });
  }

  async getActiveGasLoan(userAddress: string) {
    return await this.prisma.gasLoan.findFirst({
      where: {
        userAddress,
        status: {
          in: ['PENDING', 'ACTIVE'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // User Reputation Methods
  async updateUserReputation(userAddress: string, reputationScore: number) {
    return await this.prisma.userReputation.upsert({
      where: { userAddress },
      update: { reputationScore },
      create: {
        userAddress,
        reputationScore,
      },
    });
  }

  async updateTransactionByQuoteId(quoteId: string, data: Partial<Transaction>) {
    return await this.transactionModel.findOneAndUpdate(
      { 'details.quoteId': quoteId },
      data,
      { new: true }
    );
  }

  // Withdrawal methods
  async createWithdrawal(data: {
    walletAddress: string;
    amount: string;
    tokenAddress: string;
    tokenSymbol: string;
    status: string;
    loanId?: string;
    createdAt?: Date;
    transactionHash?: string;
  }) {
    return await this.prisma.withdrawal.create({
      data: {
        walletAddress: data.walletAddress,
        amount: data.amount,
        tokenAddress: data.tokenAddress,
        tokenSymbol: data.tokenSymbol,
        status: data.status,
        loanId: data.loanId,
        createdAt: data.createdAt || new Date(),
        transactionHash: data.transactionHash,
      },
    });
  }

  async updateWithdrawal(id: string, data: {
    status?: string;
    transactionHash?: string;
    completedAt?: Date;
    failedAt?: Date;
    unstakingTransactionHash?: string;
    finalizeTransactionHash?: string;
  }) {
    return await this.prisma.withdrawal.update({
      where: { id },
      data,
    });
  }

  async getWithdrawalById(id: string) {
    return await this.prisma.withdrawal.findUnique({
      where: { id },
    });
  }

  async getWithdrawalsByWalletAddress(walletAddress: string) {
    return await this.prisma.withdrawal.findMany({
      where: { walletAddress },
      orderBy: { createdAt: 'desc' },
    });
  }
} 