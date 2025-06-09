import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GasLoanService } from './gas-loan.service';
import { RubicSwapService } from './swap.service';
import { CollateralLockService } from './collateral-lock.service';
import { TokenWithValue } from './token-scanner.service';
import { ethers } from 'ethers';

// Mock implementations
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'RELAYER_PRIVATE_KEY') return '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    if (key === 'ETHEREUM_RPC_URL') return 'https://ethereum-rpc.example.com';
    if (key === 'SEPOLIA_RPC_URL') return 'https://sepolia-rpc.example.com';
    return null;
  }),
};

const mockRubicSwapService = {
  executeGasSponsoredSwap: jest.fn(),
};

const mockCollateralLockService = {
  lockCollateralWithWallet: jest.fn(),
  getUserStatus: jest.fn(),
};

// Mock provider for ethers
jest.mock('ethers', () => {
  const originalModule = jest.requireActual('ethers');
  return {
    ...originalModule,
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getTransactionReceipt: jest.fn().mockResolvedValue({
        gasUsed: BigInt(100000),
        gasPrice: BigInt(20000000000), // 20 gwei
      }),
      getTransaction: jest.fn().mockResolvedValue({
        gasPrice: BigInt(20000000000), // 20 gwei
        maxFeePerGas: BigInt(25000000000), // 25 gwei
      }),
    })),
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0xmockWalletAddress',
      provider: {},
    })),
    Contract: jest.fn().mockImplementation(() => ({
      permit: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({}),
      }),
    })),
    formatEther: jest.fn().mockReturnValue('0.002'),
    parseUnits: jest.fn().mockImplementation((value, decimals) => BigInt(value) * BigInt(10) ** BigInt(decimals)),
  };
});

// Mock fetch for price API calls
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ethereum: { usd: 2000 } }),
  })
);

describe('GasLoanService', () => {
  let service: GasLoanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GasLoanService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RubicSwapService, useValue: mockRubicSwapService },
        { provide: CollateralLockService, useValue: mockCollateralLockService },
      ],
    }).compile();

    service = module.get<GasLoanService>(GasLoanService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processGasLoan', () => {
    it('should process a gas loan successfully', async () => {
      // Mock data
      const mockToken: TokenWithValue = {
        chainId: '1',
        tokenAddress: '0xTokenAddress',
        symbol: 'TOKEN',
        name: 'Test Token',
        decimals: 18,
        balance: '1000000000000000000', // 1 TOKEN
        balanceFormatted: 1,
        usdValue: 10, // $10 USD
      };

      const mockPermitSignature = {
        v: 28,
        r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        s: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        nonce: 1,
      };

      const mockSwapResult = {
        transactionHash: '0xSwapTransactionHash',
        usdcObtained: '9.5', // $9.5 USDC after fees
        gasCost: '0.002', // 0.002 ETH
        timestamp: Math.floor(Date.now() / 1000),
      };

      const mockLockResult = {
        success: true,
        transactionHash: '0xLockTransactionHash',
      };

      // Set up mocks
      mockRubicSwapService.executeGasSponsoredSwap.mockResolvedValue(mockSwapResult);
      mockCollateralLockService.lockCollateralWithWallet.mockResolvedValue(mockLockResult);

      // Execute the method
      const result = await service.processGasLoan({
        userAddress: '0xUserAddress',
        token: mockToken,
        permitSignature: mockPermitSignature,
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe(mockSwapResult.transactionHash);
      expect(result.usdcObtained).toBe(mockSwapResult.usdcObtained);
      expect(result.loanAmount).toBeDefined();
      
      // Verify correct method calls
      expect(mockRubicSwapService.executeGasSponsoredSwap).toHaveBeenCalledWith(
        mockToken,
        '0xUserAddress',
      );
      
      expect(mockCollateralLockService.lockCollateralWithWallet).toHaveBeenCalledWith(
        '0xUserAddress',
        mockSwapResult.usdcObtained,
        expect.any(String), // gasCostUsd
        expect.anything(), // relayerWallet
      );
    });

    it('should handle token value outside acceptable range', async () => {
      // Mock data with token value too high
      const mockToken: TokenWithValue = {
        chainId: '1',
        tokenAddress: '0xTokenAddress',
        symbol: 'TOKEN',
        name: 'Test Token',
        decimals: 18,
        balance: '10000000000000000000', // 10 TOKEN
        balanceFormatted: 10,
        usdValue: 30, // $30 USD - outside $5-$25 range
      };

      // Execute the method
      const result = await service.processGasLoan({
        userAddress: '0xUserAddress',
        token: mockToken,
        permitSignature: {
          v: 28,
          r: '0x1234',
          s: '0x5678',
          deadline: 0,
          nonce: 0,
        },
      });

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toContain('outside acceptable range');
      
      // Verify no method calls were made
      expect(mockRubicSwapService.executeGasSponsoredSwap).not.toHaveBeenCalled();
      expect(mockCollateralLockService.lockCollateralWithWallet).not.toHaveBeenCalled();
    });

    it('should handle unsupported chain ID', async () => {
      // Mock data with unsupported chain
      const mockToken: TokenWithValue = {
        chainId: '999999', // Unsupported chain ID
        tokenAddress: '0xTokenAddress',
        symbol: 'TOKEN',
        name: 'Test Token',
        decimals: 18,
        balance: '1000000000000000000',
        balanceFormatted: 1,
        usdValue: 10,
      };

      // Execute the method
      const result = await service.processGasLoan({
        userAddress: '0xUserAddress',
        token: mockToken,
        permitSignature: {
          v: 28,
          r: '0x1234',
          s: '0x5678',
          deadline: 0,
          nonce: 0,
        },
      });

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported chain ID');
    });

    it('should handle swap failure', async () => {
      // Mock data
      const mockToken: TokenWithValue = {
        chainId: '1',
        tokenAddress: '0xTokenAddress',
        symbol: 'TOKEN',
        name: 'Test Token',
        decimals: 18,
        balance: '1000000000000000000',
        balanceFormatted: 1,
        usdValue: 10,
      };

      // Mock swap failure
      mockRubicSwapService.executeGasSponsoredSwap.mockResolvedValue({
        transactionHash: null, // No transaction hash indicates failure
      });

      // Execute the method
      const result = await service.processGasLoan({
        userAddress: '0xUserAddress',
        token: mockToken,
        permitSignature: {
          v: 28,
          r: '0x1234',
          s: '0x5678',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          nonce: 1,
        },
      });

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Swap execution failed');
      expect(mockCollateralLockService.lockCollateralWithWallet).not.toHaveBeenCalled();
    });
  });

  describe('getUserLoanStatus', () => {
    it('should get user loan status', async () => {
      // Mock data
      const mockUserStatus = {
        collateral: '100',
        loanOwed: '10',
        hasActiveLoan: true,
      };

      // Set up mock
      mockCollateralLockService.getUserStatus.mockResolvedValue(mockUserStatus);

      // Execute the method
      const result = await service.getUserLoanStatus('0xUserAddress', '1');

      // Assertions
      expect(result).toEqual(mockUserStatus);
      expect(mockCollateralLockService.getUserStatus).toHaveBeenCalledWith('0xUserAddress', '1');
    });

    it('should handle errors in getUserLoanStatus', async () => {
      // Set up mock to throw error
      mockCollateralLockService.getUserStatus.mockRejectedValue(new Error('Test error'));

      // Execute the method
      const result = await service.getUserLoanStatus('0xUserAddress', '1');

      // Assertions
      expect(result).toEqual({
        collateral: '0',
        loanOwed: '0',
        hasActiveLoan: false,
      });
    });
  });
});
