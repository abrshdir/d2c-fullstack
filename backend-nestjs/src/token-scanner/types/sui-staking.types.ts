export interface SuiStakingRequest {
  userAddress: string;
  usdcAmountToStake: string; // Changed from usdcAmount: bigint
  discountRate: number; // Kept for now, usage to be removed in service
  chainId: string; // EVM chainId from where funds are bridged
}