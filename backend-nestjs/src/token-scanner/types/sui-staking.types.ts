export interface SuiStakingRequest {
  userAddress: string;
  usdcAmount: bigint;
  discountRate: number;
  chainId: string;
} 