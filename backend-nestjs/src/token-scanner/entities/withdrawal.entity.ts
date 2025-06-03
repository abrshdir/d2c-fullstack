import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Loan } from './loan.entity';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  UNSTAKING = 'UNSTAKING',
  BRIDGING = 'BRIDGING',
  SWAPPING = 'SWAPPING',
  FINALIZING = 'FINALIZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity()
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loanId: string;

  @Column()
  walletAddress: string;

  @Column('decimal', { precision: 78, scale: 0 })
  stakedAmount: string;

  @Column('decimal', { precision: 78, scale: 0 })
  accruedRewards: string;

  @Column('decimal', { precision: 78, scale: 0 })
  accruedAmount: string;

  @Column('decimal', { precision: 78, scale: 0 })
  totalAmount: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column({ nullable: true })
  unstakingTransactionHash: string;

  @Column({ nullable: true })
  bridgeTransactionHash: string;

  @Column({ nullable: true })
  swapTransactionHash: string;

  @Column({ nullable: true })
  finalizeTransactionHash: string;

  @Column('jsonb', { nullable: true })
  details: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Loan)
  @JoinColumn({ name: 'loanId' })
  loan: Loan;
} 