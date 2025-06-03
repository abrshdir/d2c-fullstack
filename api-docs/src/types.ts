export type LoanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type StakingStatus = 'PENDING' | 'STAKED' | 'REWARDING' | 'COMPLETED';
export type TransactionType = 'DEPOSIT' | 'SWAP' | 'BRIDGE' | 'STAKE' | 'WITHDRAW';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Error {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Permit {
  owner: string;
  spender: string;
  value: string;
  deadline: string;
  v: string;
  r: string;
  s: string;
}

export interface GasLoanRequest {
  amount: string;
  tokenAddress: string;
  permit: Permit;
}

export interface GasLoanResponse {
  loanId: string;
  status: LoanStatus;
  transactionHash?: string;
  estimatedGasCost?: string;
}

export interface StakingStatus {
  loanId: string;
  status: StakingStatus;
  stakedAmount: string;
  rewardsAccrued: string;
  lastUpdateTimestamp: string;
}

export interface WithdrawRequest {
  loanId: string;
}

export interface WithdrawResponse {
  transactionHash: string;
  status: LoanStatus;
  amount: string;
  rewards: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  timestamp: string;
  transactionHash?: string;
}

export interface TransactionHistory {
  transactions: Transaction[];
}

// Database Models
export interface User {
  id: number;
  ethereumAddress: string;
  suiAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Loan {
  id: number;
  userId: number;
  amount: string;
  tokenAddress: string;
  status: LoanStatus;
  createdAt: Date;
  updatedAt: Date;
  ethereumTxHash?: string;
  suiTxHash?: string;
}

export interface StakingPosition {
  id: number;
  loanId: number;
  status: StakingStatus;
  stakedAmount: string;
  rewardsAccrued: string;
  lastUpdateTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbTransaction {
  id: number;
  userId: number;
  loanId: number;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  tokenAddress: string;
  ethereumTxHash?: string;
  suiTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reward {
  id: number;
  stakingPositionId: number;
  amount: string;
  tokenAddress: string;
  timestamp: Date;
  ethereumTxHash?: string;
  suiTxHash?: string;
} 