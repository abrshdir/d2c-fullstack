
export interface Token {
  decimals(arg0: string, decimals: any): unknown;
  chainId(chainId: any): any;
  tokenAddress(arg0: number, tokenAddress: any, tokenAddress1: any, arg3: string, fromToken: Token, userAddress: string): unknown;
  id: string;
  name: string;
  symbol: string;
  iconUrl?: string; // Placeholder for actual icon URL or component
  iconHint?: string; // For data-ai-hint
  balance: string;
  usdValue: number;
  address: string; // Mock address
}

export interface MetricCardProps {
  title: string;
  value: string;
}

export type ValidationResult = {
  isValid: boolean;
  reason?: string;
};
