import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { ethers } from 'ethers';
import { firstValueFrom } from 'rxjs';

export interface TokenBalance {
  chainId: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  usdValue: number; // Will be populated by enrichTokensWithUsdValues
  network?: string; // Network name (e.g., 'Ethereum', 'Sepolia')
}

export interface TokenWithValue extends TokenBalance {
  usdValue: number;
}

// Add new interface for Permit Data
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
}

@Injectable()
export class TokenScannerService {
  private readonly logger = new Logger(TokenScannerService.name);
  private readonly alchemyEthereumApiKey: string | undefined;
  private readonly alchemyPolygonApiKey: string | undefined;
  private readonly alchemyBaseApiKey: string | undefined;
  private readonly alchemyArbitrumApiKey: string | undefined;
  private readonly alchemyOptimismApiKey: string | undefined;
  private readonly coingeckoApiKey: string;
  private readonly MIN_NATIVE_BALANCE_USD_THRESHOLD = 1;
  private readonly COINGECKO_RATE_LIMIT = 50; // requests per minute
  private readonly COINGECKO_RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
  private lastCoingeckoRequestTime = 0;
  private coingeckoRequestCount = 0;

  // Add block explorer API keys
  private readonly etherscanApiKey: string | undefined;
  private readonly polygonscanApiKey: string | undefined;
  private readonly basescanApiKey: string | undefined;
  private readonly arbiscanApiKey: string | undefined;
  private readonly optimismscanApiKey: string | undefined;

  // Chain IDs and addresses
  private readonly ETHEREUM_CHAIN_ID = '1';
  private readonly ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  private readonly MATIC_ADDRESS = '0x0000000000000000000000000000000000001010';

  // Chain configurations
  private readonly SUPPORTED_CHAINS = [
    {
      id: '11155111', // Sepolia chain ID
      name: 'Sepolia',
      apiKeyEnv: 'ALCHEMY_SEPOLIA_API_KEY',
      nativeSymbol: 'ETH',
      nativeAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      minNativeBalance: 0.01,
    },
    {
      id: '1',
      name: 'Ethereum',
      apiKeyEnv: 'ALCHEMY_ETHEREUM_API_KEY',
      nativeSymbol: 'ETH',
      nativeAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      minNativeBalance: 0.01,
    },
    // {
    //   id: '137',
    //   name: 'Polygon',
    //   apiKeyEnv: 'ALCHEMY_POLYGON_API_KEY',
    //   nativeSymbol: 'MATIC',
    //   nativeAddress: '0x0000000000000000000000000000000000001010',
    //   minNativeBalance: 0.01,
    // },
    {
      id: '8453',
      name: 'Base',
      apiKeyEnv: 'ALCHEMY_BASE_API_KEY',
      nativeSymbol: 'ETH',
      nativeAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      minNativeBalance: 0.01,
    },
    {
      id: '42161',
      name: 'Arbitrum',
      apiKeyEnv: 'ALCHEMY_ARBITRUM_API_KEY',
      nativeSymbol: 'ETH',
      nativeAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      minNativeBalance: 0.01,
    },
    {
      id: '10',
      name: 'Optimism',
      apiKeyEnv: 'ALCHEMY_OPTIMISM_API_KEY',
      nativeSymbol: 'ETH',
      nativeAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      minNativeBalance: 0.01,
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.alchemyEthereumApiKey = this.configService.get<string>(
      'ALCHEMY_ETHEREUM_API_KEY',
    );
    this.alchemyPolygonApiKey = this.configService.get<string>(
      'ALCHEMY_POLYGON_API_KEY',
    );
    this.alchemyBaseApiKey = this.configService.get<string>(
      'ALCHEMY_BASE_API_KEY',
    );
    this.alchemyArbitrumApiKey = this.configService.get<string>(
      'ALCHEMY_ARBITRUM_API_KEY',
    );
    this.alchemyOptimismApiKey = this.configService.get<string>(
      'ALCHEMY_OPTIMISM_API_KEY',
    );

    this.coingeckoApiKey = this.configService.get<string>(
      'COINGECKO_API_KEY',
      '',
    );

    // Initialize block explorer API keys
    this.etherscanApiKey = this.configService.get<string>('ETHERSCAN_API_KEY');
    this.polygonscanApiKey = this.configService.get<string>(
      'POLYGONSCAN_API_KEY',
    );
    this.basescanApiKey = this.configService.get<string>('BASESCAN_API_KEY');
    this.arbiscanApiKey = this.configService.get<string>('ARBISCAN_API_KEY');
    this.optimismscanApiKey = this.configService.get<string>(
      'OPTIMISMSCAN_API_KEY',
    );

    // Log API key status
    this.logger.log('Token scanner service initialized. API keys status:');
    this.SUPPORTED_CHAINS.forEach((chain) => {
      const apiKey = this.configService.get<string>(chain.apiKeyEnv);
      this.logger.log(
        `${chain.name} API key: ${apiKey ? 'Set' : 'Not set (using placeholder or disabled)'}`,
      );
      if (!apiKey) {
        this.logger.warn(
          `API key for ${chain.name} (${chain.apiKeyEnv}) is not set. Scanning for this chain will be skipped.`,
        );
      }
    });
    this.logger.log(
      `CoinGecko API key: ${this.coingeckoApiKey ? 'Set' : 'Not set'}`,
    );
    this.logger.log(
      `Etherscan API key: ${this.etherscanApiKey ? 'Set' : 'Not set'}`,
    );
    this.logger.log(
      `Polygonscan API key: ${this.polygonscanApiKey ? 'Set' : 'Not set'}`,
    );
    this.logger.log(
      `Basescan API key: ${this.basescanApiKey ? 'Set' : 'Not set'}`,
    );
    this.logger.log(
      `Arbiscan API key: ${this.arbiscanApiKey ? 'Set' : 'Not set'}`,
    );
    this.logger.log(
      `Optimismscan API key: ${this.optimismscanApiKey ? 'Set' : 'Not set'}`,
    );
  }

  private getApiKeyForChain(chainId: string): string | undefined {
    const chainConfig = this.SUPPORTED_CHAINS.find((c) => c.id === chainId);
    return chainConfig
      ? this.configService.get<string>(chainConfig.apiKeyEnv)
      : undefined;
  }

  async scanWalletForTokens(walletAddress: string): Promise<{
    allTokens: TokenWithValue[];
    ethereumTokens: TokenWithValue[];
    sepoliaTokens: TokenWithValue[];
    hasStrandedValue: boolean;
    eligibleForGasLoan: boolean;
  }> {
    try {
      if (!ethers.isAddress(walletAddress)) {
        throw new HttpException(
          'Invalid wallet address',
          HttpStatus.BAD_REQUEST,
        );
      }

      let allTokens: TokenWithValue[] = [];
      let hasSufficientNativeGasOnAnyChain = false;

      // Sort chains to prioritize Sepolia
      const sortedChains = [...this.SUPPORTED_CHAINS].sort((a, b) => {
        if (a.id === '11155111') return -1; // Sepolia first
        if (b.id === '11155111') return 1;
        return 0;
      });

      for (const chain of sortedChains) {
        const apiKey = this.getApiKeyForChain(chain.id);
        if (!apiKey || apiKey.startsWith('YOUR_')) {
          this.logger.warn(
            `Skipping scan on ${chain.name} due to missing or placeholder API key!`,
          );
          continue;
        }

        try {
          const chainTokens = await this.getTokenBalances(
            walletAddress,
            chain.id,
            apiKey,
          );
          const nativeTokenBalance = this.findNativeTokenBalanceDetails(
            chainTokens,
            chain.nativeAddress,
          );

          if (
            nativeTokenBalance &&
            nativeTokenBalance.balanceFormatted >= chain.minNativeBalance
          ) {
            hasSufficientNativeGasOnAnyChain = true;
          }

          // Filter out zero balances and native tokens below threshold
          const nonZeroTokens = chainTokens.filter((token) => {
            if (token.balanceFormatted <= 0) return false;
            if (
              token.tokenAddress.toLowerCase() ===
              chain.nativeAddress.toLowerCase()
            ) {
              return token.balanceFormatted >= chain.minNativeBalance;
            }
            return true;
          });

          allTokens = [...allTokens, ...nonZeroTokens];
        } catch (error) {
          this.logger.error(
            `Error scanning ${chain.name}: ${error.message}`,
            error.stack,
          );
          // Continue with other chains even if one fails
        }
      }

      // Enrich tokens with USD values
      allTokens = await this.enrichTokensWithUsdValues(allTokens);

      // Filter tokens by chain
      const ethereumTokens = allTokens.filter(
        (token) => token.chainId === this.ETHEREUM_CHAIN_ID,
      );
      const sepoliaTokens = allTokens.filter(
        (token) => token.chainId === '11155111',
      );

      // Check if wallet has stranded value
      const hasStrandedValue = allTokens.some(
        (token) =>
          token.usdValue > 0 &&
          token.tokenAddress.toLowerCase() !== this.ETH_ADDRESS.toLowerCase() &&
          token.tokenAddress.toLowerCase() !== this.MATIC_ADDRESS.toLowerCase(),
      );

      // Check if wallet is eligible for gas loan
      const eligibleForGasLoan =
        hasStrandedValue && !hasSufficientNativeGasOnAnyChain;

      return {
        allTokens,
        ethereumTokens,
        sepoliaTokens,
        hasStrandedValue,
        eligibleForGasLoan,
      };
    } catch (error) {
      this.logger.error(`Error scanning wallet: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to scan wallet: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTokenDetailsAndPreparePermit(
    walletAddress: string,
    tokenAddress: string,
    chainId: string,
  ): Promise<{
    token: TokenWithValue;
    permitData?: PermitData;
    message?: string;
  }> {
    try {
      const apiKey = this.getApiKeyForChain(chainId);
      if (!apiKey) {
        throw new Error(`No API key found for chain ${chainId}`);
      }

      // Get token details
      const token = await this.getSingleTokenBalance(
        walletAddress,
        tokenAddress,
        chainId,
        apiKey,
      );

      if (!token.tokenBalance) {
        throw new Error('Token balance not found');
      }

      // Get token metadata
      const metadata = await this.getTokenMetadata(
        tokenAddress,
        chainId,
        apiKey,
      );

      if (!metadata) {
        throw new Error('Token metadata not found');
      }

      // Format token balance
      const balanceFormatted = parseFloat(
        ethers.formatUnits(token.tokenBalance, metadata.decimals),
      );

      // Create token object
      const tokenWithValue: TokenWithValue = {
        chainId,
        tokenAddress,
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        balance: token.tokenBalance,
        balanceFormatted,
        usdValue: 0, // Will be populated later
      };

      // Get USD value
      const prices = await this.getTokenPrices([tokenAddress], chainId);
      tokenWithValue.usdValue = prices[tokenAddress] * balanceFormatted;

      // Check if token supports EIP-2612 permit
      const provider = new ethers.JsonRpcProvider(
        this.getRpcUrlForChain(chainId, apiKey),
      );

      const permitAbi = [
        'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
        'function nonces(address owner) view returns (uint256)',
        'function DOMAIN_SEPARATOR() view returns (bytes32)',
      ];

      try {
        const contract = new ethers.Contract(tokenAddress, permitAbi, provider);

        // Get current nonce
        const nonce = await contract.nonces(walletAddress);

        // Get domain separator
        const domainSeparator = await contract.DOMAIN_SEPARATOR();

        // Prepare permit data
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const value = token.tokenBalance;

        const permitData: PermitData = {
          owner: walletAddress,
          spender: await this.getRelayerAddress(),
          value,
          nonce: Number(nonce),
          deadline,
          chainId: parseInt(chainId),
        };

        return {
          token: tokenWithValue,
          permitData,
        };
      } catch (error) {
        // Token doesn't support permit
        return {
          token: tokenWithValue,
          message: 'Token does not support EIP-2612 permit',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error getting token details: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get token details: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getTokenBalances(
    walletAddress: string,
    chainId: string,
    apiKey: string,
  ): Promise<TokenWithValue[]> {
    try {
      if (!apiKey) {
        throw new Error(`API key not set for chain ${chainId}`);
      }

      const network = this.getAlchemyNetworkName(chainId);
      if (!network) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      const rpcUrl = this.getRpcUrlForChain(chainId, apiKey);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Get native token balance
      const nativeBalance = await provider.getBalance(walletAddress);
      const nativeBalanceFormatted = parseFloat(
        ethers.formatEther(nativeBalance),
      );

      // Get token balances using Alchemy API
      const response = await firstValueFrom(
        this.httpService.post(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [walletAddress],
        }),
      );

      const { tokenBalances } = response.data.result;

      // Get token metadata for each token
      const tokens: TokenWithValue[] = [];
      for (const tokenBalance of tokenBalances) {
        const metadata = await this.getTokenMetadata(
          tokenBalance.contractAddress,
          chainId,
          apiKey,
        );

        if (metadata) {
          const balanceFormatted = parseFloat(
            ethers.formatUnits(tokenBalance.tokenBalance, metadata.decimals),
          );

          tokens.push({
            chainId,
            tokenAddress: tokenBalance.contractAddress,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            balance: tokenBalance.tokenBalance,
            balanceFormatted,
            usdValue: 0, // Will be populated later
          });
        }
      }

      // Add native token
      const chainConfig = this.SUPPORTED_CHAINS.find((c) => c.id === chainId);
      if (chainConfig) {
        tokens.push({
          chainId,
          tokenAddress: chainConfig.nativeAddress,
          symbol: chainConfig.nativeSymbol,
          name: chainConfig.nativeSymbol,
          decimals: 18,
          balance: nativeBalance.toString(),
          balanceFormatted: nativeBalanceFormatted,
          usdValue: 0, // Will be populated later
        });
      }

      return tokens;
    } catch (error) {
      this.logger.error(
        `Error getting token balances: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get token balances: ${error.message}`);
    }
  }

  private async getTokenMetadata(
    tokenAddress: string,
    chainId: string,
    apiKey: string,
  ): Promise<{ name: string; symbol: string; decimals: number } | null> {
    try {
      const network = this.getAlchemyNetworkName(chainId);
      if (!network) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      // Get token metadata using Alchemy API
      const response = await firstValueFrom(
        this.httpService.post(`https://${network}.g.alchemy.com/v2/${apiKey}`, {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenMetadata',
          params: [tokenAddress],
        }),
      );

      const { name, symbol, decimals } = response.data.result;

      return {
        name,
        symbol,
        decimals,
      };
    } catch (error) {
      this.logger.error(
        `Error getting token metadata: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  private async getNativeTokenBalance(
    walletAddress: string,
    chainId: string,
  ): Promise<number> {
    try {
      const apiKey = this.getApiKeyForChain(chainId);
      if (!apiKey) {
        throw new Error(`No API key found for chain ${chainId}`);
      }

      const rpcUrl = this.getRpcUrlForChain(chainId, apiKey);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const balance = await provider.getBalance(walletAddress);
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      this.logger.error(
        `Error getting native token balance: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get native token balance: ${error.message}`);
    }
  }

  private findNativeTokenBalance(
    tokens: TokenBalance[],
    nativeTokenAddress: string,
  ): number {
    const nativeToken = tokens.find(
      (token) =>
        token.tokenAddress.toLowerCase() === nativeTokenAddress.toLowerCase(),
    );
    return nativeToken ? nativeToken.balanceFormatted : 0;
  }

  private async enrichTokensWithUsdValues(
    tokens: TokenWithValue[],
  ): Promise<TokenWithValue[]> {
    try {
      // Group tokens by chain ID
      const tokensByChain = tokens.reduce(
        (acc, token) => {
          if (!acc[token.chainId]) {
            acc[token.chainId] = [];
          }
          acc[token.chainId].push(token);
          return acc;
        },
        {} as { [chainId: string]: TokenWithValue[] },
      );

      // Get prices for each chain
      for (const [chainId, chainTokens] of Object.entries(tokensByChain)) {
        const tokenAddresses = chainTokens.map((token) => token.tokenAddress);
        const prices = await this.getTokenPrices(tokenAddresses, chainId);

        // Update USD values
        chainTokens.forEach((token) => {
          const price = prices[token.tokenAddress] || 0;
          token.usdValue = price * token.balanceFormatted;
        });
      }

      return tokens;
    } catch (error) {
      this.logger.error(
        `Error enriching tokens with USD values: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to enrich tokens with USD values: ${error.message}`,
      );
    }
  }

  private getAlchemyNetworkName(chainId: string): string | null {
    switch (chainId) {
      case '1':
        return 'eth-mainnet';
      case '11155111':
        return 'eth-sepolia';
      case '137':
        return 'polygon-mainnet';
      case '8453':
        return 'base-mainnet';
      case '42161':
        return 'arb-mainnet';
      case '10':
        return 'opt-mainnet';
      default:
        return null;
    }
  }

  private getRpcUrlForChain(chainId: string, apiKey: string): string {
    const network = this.getAlchemyNetworkName(chainId);
    if (!network) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    if (!apiKey) {
      throw new Error(`API key not set for chain ${chainId}`);
    }
    return `https://${network}.g.alchemy.com/v2/${apiKey}`;
  }

  private async getSingleTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    chainId: string,
    apiKey: string,
  ): Promise<{ contractAddress: string; tokenBalance: string | null }> {
    try {
      const network = this.getAlchemyNetworkName(chainId);
      if (!network) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      // Get token balance using Alchemy API
      const response = await firstValueFrom(
        this.httpService.post(`https://${network}.g.alchemy.com/v2/${apiKey}`, {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [walletAddress, [tokenAddress]],
        }),
      );

      const { tokenBalances } = response.data.result;
      const tokenBalance = tokenBalances[0];

      return {
        contractAddress: tokenBalance.contractAddress,
        tokenBalance: tokenBalance.tokenBalance,
      };
    } catch (error) {
      this.logger.error(
        `Error getting single token balance: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get single token balance: ${error.message}`);
    }
  }

  private findNativeTokenBalanceDetails(
    tokens: TokenWithValue[],
    nativeTokenAddress: string,
  ): TokenWithValue | undefined {
    return tokens.find(
      (token) =>
        token.tokenAddress.toLowerCase() === nativeTokenAddress.toLowerCase(),
    );
  }

  private async getTokenPrices(
    tokenAddresses: string[],
    chainId: string,
  ): Promise<{ [tokenAddress: string]: number }> {
    try {
      const platformId = this.getCoingeckoPlatformId(chainId);
      if (!platformId) {
        throw new Error(`Unsupported chain ID for price lookup: ${chainId}`);
      }

      return await this.fetchPricesFromCoingecko(
        tokenAddresses,
        chainId,
        platformId,
      );
    } catch (error) {
      this.logger.error(
        `Error getting token prices: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get token prices: ${error.message}`);
    }
  }

  private async fetchPricesFromCoingecko(
    tokenAddresses: string[],
    chainId: string,
    platformId: string | null,
  ): Promise<{ [tokenAddress: string]: number }> {
    if (!platformId) {
      this.logger.warn(`No CoinGecko platform ID found for chain ID ${chainId}`);
      return {};
    }

    const prices: { [tokenAddress: string]: number } = {};
    
    // Process one token address at a time to comply with CoinGecko's free tier limit
    for (const address of tokenAddresses) {
      try {
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await firstValueFrom(
          this.httpService.get(
            `https://api.coingecko.com/api/v3/simple/token_price/${platformId}`,
            {
              params: {
                contract_addresses: address,
                vs_currencies: 'usd',
                x_cg_api_key: this.coingeckoApiKey,
              },
            },
          ),
        );

        if (response.data && response.data[address.toLowerCase()]) {
          prices[address] = response.data[address.toLowerCase()].usd;
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch price for token ${address} from CoinGecko:`,
          error.response?.data || error.message,
        );
        // Continue with next token even if one fails
        continue;
      }
    }

    return prices;
  }

  private getCoingeckoPlatformId(chainId: string): string | null {
    switch (chainId) {
      case '1':
        return 'ethereum';
      case '11155111':
        return 'ethereum'; // Sepolia uses Ethereum prices
      case '137':
        return 'polygon-pos';
      case '8453':
        return 'base';
      case '42161':
        return 'arbitrum-one';
      case '10':
        return 'optimistic-ethereum';
      default:
        return null;
    }
  }

  async getRelayerAddress(): Promise<string> {
    try {
      const relayerPrivateKey = this.configService.get<string>(
        'RELAYER_PRIVATE_KEY',
      );
      if (!relayerPrivateKey) {
        throw new Error('RELAYER_PRIVATE_KEY not set');
      }

      const provider = new ethers.JsonRpcProvider(
        this.configService.get<string>('ETHEREUM_RPC_URL'),
      );
      const wallet = new ethers.Wallet(relayerPrivateKey, provider);

      return wallet.address;
    } catch (error) {
      this.logger.error(
        `Error getting relayer address: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get relayer address: ${error.message}`);
    }
  }

  async scanWalletForTokensTest(
    walletAddress: string,
    isDevelopment: boolean,
  ): Promise<{
    allTokens: TokenWithValue[];
    ethereumTokens: TokenWithValue[];
    sepoliaTokens: TokenWithValue[];
    hasStrandedValue: boolean;
    eligibleForGasLoan: boolean;
  }> {
    try {
      if (!ethers.isAddress(walletAddress)) {
        throw new HttpException(
          'Invalid wallet address',
          HttpStatus.BAD_REQUEST,
        );
      }

      // In development mode, return mock data
      if (isDevelopment) {
        const mockTokens: TokenWithValue[] = [
          {
            chainId: '1',
            tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: '1000000',
            balanceFormatted: 1.0,
            usdValue: 1.0,
          },
          {
            chainId: '11155111',
            tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
            balance: '100000000000000000',
            balanceFormatted: 0.1,
            usdValue: 0.1 * 2000, // Assuming 1 ETH = $2000
          },
        ];

        return {
          allTokens: mockTokens,
          ethereumTokens: mockTokens.filter((t) => t.chainId === '1'),
          sepoliaTokens: mockTokens.filter((t) => t.chainId === '11155111'),
          hasStrandedValue: true,
          eligibleForGasLoan: true,
        };
      }

      // In production, use the real implementation
      return this.scanWalletForTokens(walletAddress);
    } catch (error) {
      this.logger.error(`Error scanning wallet: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to scan wallet: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getGasPrices(chainId: string): Promise<{
    safeLow?: string;
    average?: string;
    fast?: string;
    veryFast?: string;
    suggestBaseFee?: string;
    gasUsedRatio?: string;
  } | null> {
    try {
      const config = this.getBlockExplorerConfig(chainId);
      if (!config) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      const response = await firstValueFrom(
        this.httpService.get(`${config.baseUrl}/api`, {
          params: {
            module: 'gastracker',
            action: 'gasoracle',
            apikey: config.apiKey,
          },
        }),
      );

      if (response.data.status === '1') {
        return {
          safeLow: response.data.result.SafeGasPrice,
          average: response.data.result.ProposeGasPrice,
          fast: response.data.result.FastGasPrice,
          veryFast: response.data.result.FastGasPrice,
          suggestBaseFee: response.data.result.suggestBaseFee,
          gasUsedRatio: response.data.result.gasUsedRatio,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error getting gas prices: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get gas prices: ${error.message}`);
    }
  }

  private getBlockExplorerConfig(chainId: string): {
    baseUrl: string;
    apiKey: string | undefined;
  } | null {
    switch (chainId) {
      case '1':
        return {
          baseUrl: 'https://api.etherscan.io',
          apiKey: this.etherscanApiKey,
        };
      case '11155111':
        return {
          baseUrl: 'https://api-sepolia.etherscan.io',
          apiKey: this.etherscanApiKey,
        };
      case '137':
        return {
          baseUrl: 'https://api.polygonscan.com',
          apiKey: this.polygonscanApiKey,
        };
      case '8453':
        return {
          baseUrl: 'https://api.basescan.org',
          apiKey: this.basescanApiKey,
        };
      case '42161':
        return {
          baseUrl: 'https://api.arbiscan.io',
          apiKey: this.arbiscanApiKey,
        };
      case '10':
        return {
          baseUrl: 'https://api-optimistic.etherscan.io',
          apiKey: this.optimismscanApiKey,
        };
      default:
        return null;
    }
  }

  private async waitForCoingeckoRateLimit() {
    const now = Date.now();
    if (now - this.lastCoingeckoRequestTime >= this.COINGECKO_RATE_LIMIT_WINDOW) {
      // Reset counter if window has passed
      this.coingeckoRequestCount = 0;
      this.lastCoingeckoRequestTime = now;
    }

    if (this.coingeckoRequestCount >= this.COINGECKO_RATE_LIMIT) {
      // Wait until the rate limit window resets
      const waitTime = this.COINGECKO_RATE_LIMIT_WINDOW - (now - this.lastCoingeckoRequestTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.coingeckoRequestCount = 0;
      this.lastCoingeckoRequestTime = Date.now();
    }

    this.coingeckoRequestCount++;
  }

  private async getTokenPriceFromCoinGecko(tokenAddress: string): Promise<number> {
    try {
      await this.waitForCoingeckoRateLimit();

      const response = await firstValueFrom(
        this.httpService.get(
          `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd`,
          {
            headers: this.coingeckoApiKey
              ? { 'x-cg-pro-api-key': this.coingeckoApiKey }
              : {},
          },
        ),
      );

      const price = response.data[tokenAddress.toLowerCase()]?.usd;
      return price || 0;
    } catch (error) {
      this.logger.error(
        `Failed to fetch price for token ${tokenAddress} from CoinGecko:`,
        error.response?.data || error.message,
      );
      return 0;
    }
  }
}
