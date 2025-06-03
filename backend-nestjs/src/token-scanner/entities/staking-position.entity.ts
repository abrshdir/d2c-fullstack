import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Loan } from './loan.entity';
import { Transaction } from './transaction.entity';

export enum StakingStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  UNSTAKING = 'UNSTAKING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity()
export class StakingPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loanId: string;

  @Column()
  walletAddress: string;

  @Column()
  validatorAddress: string;

  @Column('decimal', { precision: 78, scale: 0 })
  stakedAmount: string;

  @Column('decimal', { precision: 78, scale: 0, default: '0' })
  accruedRewards: string;

  @Column()
  stakingPeriodDays: number;

  @Column()
  stakingStartTime: Date;

  @Column()
  stakingEndTime: Date;

  @Column({
    type: 'enum',
    enum: StakingStatus,
    default: StakingStatus.PENDING,
  })
  status: StakingStatus;

  @Column({ nullable: true })
  transactionHash: string;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Loan)
  @JoinColumn({ name: 'loanId' })
  loan: Loan;

  @OneToMany(() => Transaction, transaction => transaction.stakingPosition)
  transactions: Transaction[];
} 