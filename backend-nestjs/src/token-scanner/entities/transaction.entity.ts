import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Loan } from './loan.entity';
import { StakingPosition } from './staking-position.entity';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  SWAP = 'SWAP',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  CLAIM_REWARDS = 'CLAIM_REWARDS',
  BRIDGE = 'BRIDGE',
  TRANSFER = 'TRANSFER',
  INITIATE_WITHDRAWAL = 'INITIATE_WITHDRAWAL',
  FINALIZE_WITHDRAWAL = 'FINALIZE_WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  loanId: string;

  @Column()
  walletAddress: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column('decimal', { precision: 78, scale: 0 })
  amount: string;

  @Column()
  tokenAddress: string;

  @Column({ nullable: true })
  tokenSymbol: string;

  @Column({ nullable: true })
  transactionHash: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @Column({ nullable: true })
  stakingPositionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Loan, { nullable: true })
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @ManyToOne(() => StakingPosition, { nullable: true })
  @JoinColumn({ name: 'stakingPositionId' })
  stakingPosition: StakingPosition;
} 