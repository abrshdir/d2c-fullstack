/**
 * Response from the Rubic API for a swap quote
 */
export interface SwapQuote {
  id: string;
  fromToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    blockchain: string;
    balance: string;
    usdValue: number;
  };
  toToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    blockchain: string;
    balance: string;
    usdValue: number;
  };
  toTokenAmount: string;
  fromTokenAmount: string;
  protocols: string[];
  estimatedGas: {
    gasEstimate: string;
    gasCostInEth: string;
    gasCostInUsd: string;
  };
}

/**
 * Response from the Rubic API for a swap transaction
 */
export interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
}

/**
 * Response from the Rubic API for a swap status
 */
export interface SwapStatus {
  status: string;
  destinationTxHash?: string;
}

/**
 * Result of executing a swap
 */
export interface SwapResult {
  transactionHash: string;
  usdcObtained: string;
  gasCost: string;
  timestamp: number;
}

/**
 * Status of a bridge transaction
 */
export enum BridgeStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Result of executing a bridge operation
 */
export interface BridgeResult {
  success: boolean;
  transactionHash?: string;
  sourceToken?: string;
  sourceAmount?: string;
  targetToken?: string;
  targetChain?: number;
  status?: BridgeStatus;
  error?: string;
  usdcObtained?: string;
  gasCost?: string;
  timestamp?: number;
  bridgeProvider?: string;
  estimatedArrivalTime?: number;
}

/**
 * Rubic API request for a quote
 */
export interface QuoteRequestDto {
  srcTokenAddress: string;
  srcTokenAmount: string;
  srcTokenBlockchain: string;
  dstTokenAddress: string;
  dstTokenBlockchain: string;
  fromAddress: string;
  receiver: string;
  slippage: number;
  referrer?: string;
}

/**
 * Rubic API response for a quote
 */
export interface QuoteResponseDto {
  id: string;
  provider: string;
  estimate: {
    destinationTokenAmount: string;
    destinationTokenMinAmount: string;
    priceImpact: number;
    estimatedGas?: string;
  };
  error?: {
    code: number;
    reason: string;
  };
}

/**
 * Rubic API request for a swap
 */
export interface SwapRequestDto extends QuoteRequestDto {
  id: string;
}

/**
 * Rubic API response for a swap
 */
export interface SwapResponseDto {
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
  };
}

/**
 * Uniswap API request for a quote
 */
export interface UniswapQuoteRequestDto {
  tokenInAddress: string;
  tokenInChainId: number;
  tokenOutAddress: string;
  tokenOutChainId: number;
  amount: string;
  type: 'exactIn' | 'exactOut';
  recipient?: string;
  slippageTolerance?: number;
  deadline?: number;
  algorithm?: string;
  protocols?: string[];
  enableUniversalRouter?: boolean;
}

/**
 * Protocolink API response for a quote
 */
export interface ProtocolinkQuoteResponseDto {
  tradeType: string;
  input: {
    token: {
      chainId: number;
      address: string;
      decimals: number;
      symbol: string;
      name: string;
    };
    amount: string;
  };
  output: {
    token: {
      chainId: number;
      address: string;
      decimals: number;
      symbol: string;
      name: string;
    };
    amount: string;
  };
  path: string;
  slippage: number;
}

/**
 * Uniswap API response for a quote
 */
export interface UniswapQuoteResponseDto {
  quoteId?: string;
  blockNumber: string;
  amount: string;
  amountDecimals: string;
  quote: string;
  quoteDecimals: string;
  quoteGasAdjusted: string;
  quoteGasAdjustedDecimals: string;
  gasUseEstimate: string;
  gasUseEstimateQuote: string;
  gasUseEstimateQuoteDecimals: string;
  gasUseEstimateUSD: string;
  gasPriceWei: string;
  route: any[];
  routeString: string;
  quoteGasAndSlippage?: string;
  quoteGasAndSlippageDecimals?: string;
}

/**
 * Uniswap API request for a swap
 */
export interface UniswapSwapRequestDto extends UniswapQuoteRequestDto {
  quoteId?: string;
}

/**
 * Uniswap API response for a swap
 */
export interface UniswapSwapResponseDto {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPrice?: string;
  chainId: number;
}

/**
 * Wormhole bridge preparation result
 */
export interface WormholeBridgePreparation {
  sourceToken: string;
  sourceAmount: string;
  targetChain: number;
  targetAddress: string;
  relayerFee: string;
  nonce: string;
}