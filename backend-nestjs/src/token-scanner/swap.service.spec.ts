import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  RubicSwapService
} from './swap.service';
import { of, throwError } from 'rxjs';
import { TokenWithValue } from './token-scanner.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SwapQuote } from './types/rubic-types';

describe('RubicSwapService', () => {
  let service: RubicSwapService;
  let httpServiceMock: any;

  const mockToken: TokenWithValue = {
    chainId: '1',
    tokenAddress: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI token
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    balance: '1000000000000000000', // 1 UNI
    balanceFormatted: 1,
    usdValue: 5,
    address: '',
    value: 0
  };

  const mockQuoteResponse = {
    id: 'quote-123',
    provider: 'test-provider',
    estimate: {
      destinationTokenAmount: '5000000', // 5 USDC (6 decimals)
      destinationTokenMinAmount: '4950000', // 4.95 USDC with 1% slippage
      priceImpact: 0.5,
      estimatedGas: '150000',
    },
  };

  const mockSwapResponse = {
    transaction: {
      to: '0x3335733c454805df6a77f825f266e136FB4a3333',
      data: '0x123abc',
      value: '0',
      gasLimit: '200000',
    },
  };

  beforeEach(async () => {
    httpServiceMock = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const configServiceMock = {
      get: jest.fn((key, defaultValue) => {
        if (key === 'SWAP_EXECUTOR_ADDRESS') {
          return '0x3335733c454805df6a77f825f266e136FB4a3333'; // Mock the swap executor address
        }
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        RubicSwapService,
        {
          provide: HttpService,
          useValue: httpServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<RubicSwapService>(RubicSwapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSwapQuote', () => {
    it('should return a swap quote', async () => {
      httpServiceMock.post.mockReturnValueOnce(
        of({
          data: mockQuoteResponse,
        }),
      );

      const result = await service.getSwapQuote(
        mockToken.tokenAddress,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        mockToken.balanceFormatted.toString(),
        '0x123456789abcdef',
        mockToken.chainId,
      );

      expect(result).toBeDefined();
      expect(result.id).toEqual(mockQuoteResponse.id);
      expect(result.toTokenAmount).toEqual(
        mockQuoteResponse.estimate.destinationTokenAmount,
      );
      expect(httpServiceMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/routes/quoteBest'),
        expect.objectContaining({
          srcTokenAddress: mockToken.tokenAddress.toLowerCase(),
          srcTokenAmount: mockToken.balanceFormatted.toString(),
          dstTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        }),
      );
    });
  });

  describe('getSwapTransaction', () => {
    it('should return swap transaction data', async () => {
      httpServiceMock.post.mockReturnValueOnce(
        of({
          data: mockSwapResponse,
        }),
      );

      const result = await service.getSwapTransaction(
        'quote-123',
        mockToken.tokenAddress,
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        mockToken.balanceFormatted.toString(),
        '0x123456789abcdef',
        mockToken.chainId,
      );

      expect(result).toBeDefined();
      expect(result.to).toEqual(mockSwapResponse.transaction.to);
      // The data field contains the encoded function call which includes the transaction data
      expect(result.data).toContain(
        mockSwapResponse.transaction.data.substring(2),
      ); // Remove '0x' prefix for substring check
      expect(httpServiceMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/routes/swap'),
        expect.objectContaining({
          id: 'quote-123',
          srcTokenAddress: mockToken.tokenAddress.toLowerCase(),
        }),
      );
    });
  });

  describe('getSwapStatus', () => {
    it('should return swap status', async () => {
      const mockStatusResponse = {
        status: 'SUCCESS',
        destinationTxHash: '0xabc123',
      };

      // Setup the mock for get method
      httpServiceMock.get.mockReturnValueOnce(
        of({
          data: mockStatusResponse,
        }),
      );

      const result = await service.getSwapStatus('0x123456');

      expect(result).toBeDefined();
      expect(result.status).toEqual('SUCCESS');
      expect(result.destinationTxHash).toEqual('0xabc123');
      expect(httpServiceMock.get).toHaveBeenCalledWith(
        expect.stringContaining('/info/status?srcTxHash=0x123456'),
      );
    });

    it('should return NOT_FOUND status when transaction is not found', async () => {
      // Setup the mock for get method to return NOT_FOUND status
      const mockNotFoundResponse = {
        status: 'NOT_FOUND',
        destinationTxHash: null,
        destinationNetworkChainId: null,
        destinationNetworkTitle: null,
      };

      httpServiceMock.get.mockReturnValueOnce(
        of({
          data: mockNotFoundResponse,
        }),
      );

      const result = await service.getSwapStatus('0x123456');

      expect(result).toBeDefined();
      expect(result.status).toEqual('NOT_FOUND');
      expect(result.destinationTxHash).toBeNull();
      expect(httpServiceMock.get).toHaveBeenCalledWith(
        expect.stringContaining('/info/status?srcTxHash=0x123456'),
      );
    });
  });

  describe('getTokenSwapQuote', () => {
    it('should call getSwapQuote with correct parameters', async () => {
      // Create a mock SwapQuote result
      const mockSwapQuote: SwapQuote = {
        id: 'quote-123',
        fromToken: {
          address: mockToken.tokenAddress,
          symbol: 'UNI',
          name: 'Uniswap',
          decimals: 18,
          blockchain: 'ETH',
          balance: '1000000000000000000',
          usdValue: 10.5,
        },
        toToken: {
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          blockchain: 'ETH',
          balance: '5000000',
          usdValue: 5.0,
        },
        toTokenAmount: '5000000',
        fromTokenAmount: '1000000000000000000',
        protocols: ['UNISWAP_V3'],
        estimatedGas: {
          gasEstimate: '150000',
          gasCostInEth: '0.003',
          gasCostInUsd: '6.00'
        },
      };

      // Mock the getSwapQuote method directly
      jest.spyOn(service, 'getSwapQuote').mockResolvedValueOnce(mockSwapQuote);

      // Call the method
      const result = await service.getTokenSwapQuote(mockToken);

      // Assert the result is the mock quote
      expect(result).toEqual(mockSwapQuote);

      // Assert that getSwapQuote was called with the correct parameters
      expect(service.getSwapQuote).toHaveBeenCalledWith(
        mockToken.tokenAddress,
        expect.any(String), // USDC_ETH address
        mockToken.balanceFormatted.toString(),
        '', // Empty wallet address
        mockToken.chainId,
      );
    });
  });
});
