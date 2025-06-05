export interface Token {
  tokenAddress: string;
  chainId: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  usdValue: number;
  address: string;
  value: number;
}

export interface TokenScanResponse {
  topTokens: Token[];
  hasStrandedValue: boolean;
  allTokens?: Token[];
  ethereumTokens?: Token[];
  sepoliaTokens?: Token[];
  gasSponsoredSwapAvailable?: boolean;
  outstandingDebt?: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface PermitData {
  owner: string;
  spender: string;
  value: string;
  nonce: number;
  deadline: number;
  // EIP-2612 specific fields for the signature
  v?: number;
  r?: string;
  s?: string;
  // ChainId for the permit signature
  chainId: number;
  // Token information
  name?: string;
  symbol?: string;
  tokenAddress?: string;
  // Additional field for permit message structure
  message?: {
    owner: string;
    spender: string;
    value: string;
    nonce: number;
    deadline: number;
  };
}

export interface GasLoanRequest {
  userAddress: string;
  tokenAmount: string;
  gasDebt: string;
  token: Token;
}

export interface GasLoanResponse {
  id: string;
  userAddress: string;
  tokenAmount: string;
  gasDebt: string;
  status: string;
  createdAt: string;
  contractTxHash?: string;
  repaymentTxHash?: string;
  repaidAt?: string;
  missedAt?: string;
}

export enum StakingStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface WithdrawRequest {
  walletAddress: string;
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
}

export interface WithdrawResponse {
  id: string;
  walletAddress: string;
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
  status: string;
  loanId?: string;
  createdAt: string;
  transactionHash?: string;
  completedAt?: string;
  failedAt?: string;
  unstakingTransactionHash?: string;
  finalizeTransactionHash?: string;
}

export interface TransactionHistory {
  id: string;
  type: string;
  status: string;
  amount: string;
  tokenSymbol: string;
  timestamp: string;
  transactionHash?: string;
  loanId?: string;
  withdrawalId?: string;
}

export interface Error {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Note: 'Error' is a built-in type in TypeScript.
// It's recommended to use a more specific name to avoid conflicts,
// but based on the OpenAPI schema, we will define it as 'ApiErrorResponse'
// to distinguish it from the built-in Error type.
// However, the error message refers to 'Error', so we will add an
// interface named 'Error' for now to resolve the TypeScript error,
// but be aware of the potential naming conflict.
// However, the error message refers to 'Error', so we will add an
// interface named 'Error' for now to resolve the TypeScript error,
// but be aware of the potential naming conflict.
export interface ApiErrorResponse {
  code?: string;
  message?: string;
  details?: object;
}

// It's generally better practice to use a more specific name like:
/*
export interface ApiErrorResponse {
  code?: string;
  message?: string;
  details?: object;
}*/
