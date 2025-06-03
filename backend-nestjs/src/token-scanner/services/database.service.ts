import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { StakingPosition, StakingStatus } from '../entities/staking-position.entity';
import { Withdrawal, WithdrawalStatus } from '../entities/withdrawal.entity';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Loan)
    private loanRepository: Repository<Loan>,
    @InjectRepository(StakingPosition)
    private stakingPositionRepository: Repository<StakingPosition>,
    @InjectRepository(Withdrawal)
    private withdrawalRepository: Repository<Withdrawal>,
  ) {}

  // Transaction methods
  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    const newTransaction = this.transactionRepository.create(transaction);
    return await this.transactionRepository.save(newTransaction);
  }

  async updateTransaction(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
    await this.transactionRepository.update(id, transaction);
    const updatedTransaction = await this.transactionRepository.findOne({ where: { id } });
    if (!updatedTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return updatedTransaction;
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({ where: { id } });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    return transaction;
  }

  async getTransactionsByWalletAddress(walletAddress: string): Promise<Transaction[]> {
    return await this.transactionRepository.find({ where: { walletAddress } });
  }

  async getTransactionsByWalletAddressAndType(
    walletAddress: string,
    type: TransactionType,
  ): Promise<Transaction[]> {
    return await this.transactionRepository.find({ where: { walletAddress, type } });
  }

  async getTransactionsByStakingPositionId(stakingPositionId: string): Promise<Transaction[]> {
    return await this.transactionRepository.find({ where: { stakingPositionId } });
  }

  // Loan methods
  async createLoan(loan: Partial<Loan>): Promise<Loan> {
    const newLoan = this.loanRepository.create(loan);
    return await this.loanRepository.save(newLoan);
  }

  async updateLoan(id: string, loan: Partial<Loan>): Promise<Loan> {
    await this.loanRepository.update(id, loan);
    const updatedLoan = await this.loanRepository.findOne({ where: { id } });
    if (!updatedLoan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return updatedLoan;
  }

  async getLoanById(id: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({ where: { id } });
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return loan;
  }

  async getLoansByWalletAddress(walletAddress: string): Promise<Loan[]> {
    return await this.loanRepository.find({ where: { walletAddress } });
  }

  // Staking position methods
  async createStakingPosition(stakingPosition: Partial<StakingPosition>): Promise<StakingPosition> {
    const newStakingPosition = this.stakingPositionRepository.create(stakingPosition);
    return await this.stakingPositionRepository.save(newStakingPosition);
  }

  async updateStakingPosition(
    id: string,
    stakingPosition: Partial<StakingPosition>,
  ): Promise<StakingPosition> {
    await this.stakingPositionRepository.update(id, stakingPosition);
    const updatedStakingPosition = await this.stakingPositionRepository.findOne({ where: { id } });
    if (!updatedStakingPosition) {
      throw new NotFoundException(`Staking position with ID ${id} not found`);
    }
    return updatedStakingPosition;
  }

  async getStakingPositionById(id: string): Promise<StakingPosition> {
    const stakingPosition = await this.stakingPositionRepository.findOne({ where: { id } });
    if (!stakingPosition) {
      throw new NotFoundException(`Staking position with ID ${id} not found`);
    }
    return stakingPosition;
  }

  async getStakingPositionsByValidatorAddress(validatorAddress: string): Promise<StakingPosition[]> {
    return await this.stakingPositionRepository.find({ where: { validatorAddress } });
  }

  async getStakingPositionsByWalletAddress(walletAddress: string): Promise<StakingPosition[]> {
    return await this.stakingPositionRepository.find({ where: { walletAddress } });
  }

  // Withdrawal methods
  async createWithdrawal(withdrawal: Partial<Withdrawal>): Promise<Withdrawal> {
    const newWithdrawal = this.withdrawalRepository.create(withdrawal);
    return await this.withdrawalRepository.save(newWithdrawal);
  }

  async updateWithdrawal(id: string, withdrawal: Partial<Withdrawal>): Promise<Withdrawal> {
    await this.withdrawalRepository.update(id, withdrawal);
    const updatedWithdrawal = await this.withdrawalRepository.findOne({ where: { id } });
    if (!updatedWithdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }
    return updatedWithdrawal;
  }

  async getWithdrawalById(id: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepository.findOne({ where: { id } });
    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }
    return withdrawal;
  }

  async getWithdrawalsByWalletAddress(walletAddress: string): Promise<Withdrawal[]> {
    return await this.withdrawalRepository.find({ where: { walletAddress } });
  }
} 