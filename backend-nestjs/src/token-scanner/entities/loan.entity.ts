import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Transaction } from './transaction.entity';
import { StakingPosition } from './staking-position.entity';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  STAKING = 'STAKING',
  WITHDRAWING = 'WITHDRAWING',
  CLOSED = 'CLOSED',
  COMPLETED = 'COMPLETED',
}

@Entity()
export class Loan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  walletAddress: string;

  @Column('decimal', { precision: 78, scale: 0 })
  collateralAmount: string;

  @Column()
  collateralTokenAddress: string;

  @Column()
  collateralTokenSymbol: string;

  @Column('decimal', { precision: 78, scale: 0 })
  loanAmount: string;

  @Column()
  loanTokenAddress: string;

  @Column()
  loanTokenSymbol: string;

  @Column({
    type: 'enum',
    enum: LoanStatus,
    default: LoanStatus.ACTIVE,
  })
  status: LoanStatus;

  @Column({ nullable: true })
  swapTransactionHash: string;

  @Column('decimal', { precision: 78, scale: 0, nullable: true })
  swappedAmount: string;

  @Column({ nullable: true })
  swappedTokenAddress: string;

  @Column({ nullable: true })
  swappedTokenSymbol: string;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Transaction, transaction => transaction.loan)
  transactions: Transaction[];

  @OneToMany(() => StakingPosition, stakingPosition => stakingPosition.loan)
  stakingPositions: StakingPosition[];
} 