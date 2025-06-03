export interface Token {
  chainId: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  usdValue: number;
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
  amount: string;
  tokenAddress: string;
  permit: { // ERC-2612 permit data
    owner: string;
    spender: string;
    value: string;
    deadline: string;
    v: string;
    r: string;
    s: string;
  };
}

export interface GasLoanResponse {
  loanId?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  transactionHash?: string;
  estimatedGasCost?: string;
}

export interface StakingStatus {
  loanId?: string;
  status?: 'PENDING' | 'STAKED' | 'REWARDING' | 'COMPLETED';
  stakedAmount?: string;
  rewardsAccrued?: string;
  lastUpdateTimestamp?: string;
}

export interface WithdrawRequest {
  loanId: string;
}

export interface WithdrawResponse {
  transactionHash?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  amount?: string;
  rewards?: string;
}

export interface TransactionHistory {
  transactions?: Array<{
    id?: string;
    type?: 'DEPOSIT' | 'SWAP' | 'BRIDGE' | 'STAKE' | 'WITHDRAW';
    status?: 'PENDING' | 'COMPLETED' | 'FAILED';
    amount?: string;
    timestamp?: string;
    transactionHash?: string;
  }>;
}

// Note: 'Error' is a built-in type in TypeScript.
// It's recommended to use a more specific name to avoid conflicts,
// but based on the OpenAPI schema, we will define it as 'ApiErrorResponse'
// to distinguish it from the built-in Error type.
// However, the error message refers to 'Error', so we will add an
// interface named 'Error' for now to resolve the TypeScript error,
// but be aware of the potential naming conflict.
export interface Error {
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
