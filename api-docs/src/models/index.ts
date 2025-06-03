import mongoose, { Schema, Document } from 'mongoose';
import { LoanStatus, StakingStatus, TransactionType, TransactionStatus } from '../types';

// User Model
export interface IUser extends Document {
  ethereumAddress: string;
  suiAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  ethereumAddress: { type: String, required: true, unique: true },
  suiAddress: { type: String, required: true, unique: true }
}, { timestamps: true });

// Loan Model
export interface ILoan extends Document {
  userId: mongoose.Types.ObjectId;
  amount: string;
  tokenAddress: string;
  status: LoanStatus;
  ethereumTxHash?: string;
  suiTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<ILoan>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], required: true },
  ethereumTxHash: { type: String },
  suiTxHash: { type: String }
}, { timestamps: true });

// StakingPosition Model
export interface IStakingPosition extends Document {
  loanId: mongoose.Types.ObjectId;
  status: StakingStatus;
  stakedAmount: string;
  rewardsAccrued: string;
  lastUpdateTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StakingPositionSchema = new Schema<IStakingPosition>({
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
  status: { type: String, enum: ['PENDING', 'STAKED', 'REWARDING', 'COMPLETED'], required: true },
  stakedAmount: { type: String, required: true },
  rewardsAccrued: { type: String, required: true, default: '0' },
  lastUpdateTimestamp: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

// Transaction Model
export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  loanId: mongoose.Types.ObjectId;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  tokenAddress: string;
  ethereumTxHash?: string;
  suiTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
  type: { type: String, enum: ['DEPOSIT', 'SWAP', 'BRIDGE', 'STAKE', 'WITHDRAW'], required: true },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], required: true },
  amount: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  ethereumTxHash: { type: String },
  suiTxHash: { type: String }
}, { timestamps: true });

// Reward Model
export interface IReward extends Document {
  stakingPositionId: mongoose.Types.ObjectId;
  amount: string;
  tokenAddress: string;
  timestamp: Date;
  ethereumTxHash?: string;
  suiTxHash?: string;
}

const RewardSchema = new Schema<IReward>({
  stakingPositionId: { type: Schema.Types.ObjectId, ref: 'StakingPosition', required: true },
  amount: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  timestamp: { type: Date, required: true, default: Date.now },
  ethereumTxHash: { type: String },
  suiTxHash: { type: String }
});

// Create and export models
export const User = mongoose.model<IUser>('User', UserSchema);
export const Loan = mongoose.model<ILoan>('Loan', LoanSchema);
export const StakingPosition = mongoose.model<IStakingPosition>('StakingPosition', StakingPositionSchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export const Reward = mongoose.model<IReward>('Reward', RewardSchema); 