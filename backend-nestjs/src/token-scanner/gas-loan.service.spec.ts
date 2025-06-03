import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GasLoanService } from './gas-loan.service';
import { RubicSwapService } from './rubic-swap.service';
// CollateralLockService import removed
import { Dust2CashEscrowService } from './services/dust2cash-escrow.service'; // Import new service
import { TokenWithValue } from './token-scanner.service';
import { ethers } from 'ethers'; // Keep ethers for mocks if needed by other parts, or original module

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

// mockCollateralLockService removed

const mockDust2CashEscrowService = {
  depositForUser: jest.fn(),
  getUserAccountStatus: jest.fn(),
};

// Mock provider for ethers - This mock might need adjustment if Dust2CashEscrowService relies on different ethers features
// For now, assuming it's compatible or that Dust2CashEscrowService's own tests cover its ethers interactions.
// The existing mock for ethers.Contract might conflict if not managed carefully.
// It's often better to mock service dependencies rather than deep mocking libraries like ethers unless essential.
jest.mock('ethers', () => {
  const originalEthers = jest.requireActual('ethers');
  return {
    ...originalEthers, // Use original ethers for most things
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
    // Wallet and Contract mocks are more specific to GasLoanService's direct use (e.g., for permit)
    Wallet: jest.fn().mockImplementation((privateKey, provider) => ({
      address: '0xMockRelayerAddress', // Simulate relayer wallet
      provider: provider,
      // Mock other Wallet methods if GasLoanService uses them directly
    })),
    Contract: jest.fn().mockImplementation((address, abi, signerOrProvider) => ({
      // Mock for the ERC20 permit call
      permit: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ status: 1 /* success */ }),
      }),
      // Add other contract methods if GasLoanService calls them directly on other contracts
    })),
    providers: { // Keep JsonRpcProvider mock if GasLoanService uses it directly
      ...originalEthers.providers, // Use original providers
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getTransactionReceipt: jest.fn().mockResolvedValue({
          gasUsed: BigInt(100000),
          gasPrice: BigInt(20000000000), // 20 gwei
        }),
        getTransaction: jest.fn().mockResolvedValue({
          gasPrice: BigInt(20000000000),
        }),
        // Mock other provider methods if necessary
      })),
    },
    utils: { // Keep original utils
      ...originalEthers.utils,
    },
    // formatEther and parseUnits are part of utils, so they are covered by ...originalEthers.utils
  };
});

// Ensure ethers.formatEther and ethers.parseUnits are available for tests if not fully covered by utils spread
// This might be redundant if ...originalEthers.utils works as expected.
if (typeof ethers.formatEther !== 'function') {
  ethers.formatEther = jest.fn().mockReturnValue('0.002');
}
if (typeof ethers.parseUnits !== 'function') {
  ethers.parseUnits = jest.fn().mockImplementation((value, decimals) => BigInt(value) * BigInt(10) ** BigInt(decimals as number));
}

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
        // { provide: CollateralLockService, useValue: mockCollateralLockService }, // Removed
        { provide: Dust2CashEscrowService, useValue: mockDust2CashEscrowService }, // Added
      ],
    }).compile();

    service = module.get<GasLoanService>(GasLoanService);
     // Ensure ethers.Wallet and ethers.Contract mocks are fresh for each test if they maintain state
     // This is generally handled by jest.clearAllMocks() but can be explicit if needed.
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processGasLoan', () => {
    const mockUserAddress = '0xUserAddress';
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
      deadline: Math.floor(Date.now() / 1000) + 3600,
      nonce: 1,
    };
    const mockSwapResult = {
      transactionHash: '0xSwapTransactionHash',
      usdcObtained: '9.5', // $9.5 USDC after fees
      gasCost: '0.002', // This is ETH gas cost, not the USD value of gas for loan
      timestamp: Math.floor(Date.now() / 1000),
    };
    // gasCostUsd will be calculated by calculateGasCostUsd, let's assume it's '4.00' for this test
    const calculatedGasCostUsd = '4.000000';

    it('should process a gas loan successfully', async () => {
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

      // Set up mocks for a successful path
      mockRubicSwapService.executeGasSponsoredSwap.mockResolvedValue(mockSwapResult);
      // Spy on calculateGasCostUsd or ensure its mock behavior is what we expect for this test
      // For this test, we'll assume it returns `calculatedGasCostUsd`
      jest.spyOn(service as any, 'calculateGasCostUsd').mockResolvedValue(calculatedGasCostUsd);
      mockDust2CashEscrowService.depositForUser.mockResolvedValue({
        hash: '0xDepositTxHash',
        wait: jest.fn().mockResolvedValue({ status: 1 }) // Mock wait() method
      });


      const result = await service.processGasLoan({
        userAddress: mockUserAddress,
        token: mockToken,
        permitSignature: mockPermitSignature,
      });

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe(mockSwapResult.transactionHash);
      expect(result.usdcObtained).toBe(mockSwapResult.usdcObtained);
      expect(result.gasCostUsd).toBe(calculatedGasCostUsd); // Gas cost of the swap
      expect(result.loanAmount).toBe(calculatedGasCostUsd); // Loan amount is the gas cost
      
      expect(mockRubicSwapService.executeGasSponsoredSwap).toHaveBeenCalledWith(mockToken, mockUserAddress);
      expect(service['calculateGasCostUsd']).toHaveBeenCalledWith(mockSwapResult.transactionHash, mockToken.chainId);
      expect(mockDust2CashEscrowService.depositForUser).toHaveBeenCalledWith(
        mockUserAddress,
        mockSwapResult.usdcObtained,
        calculatedGasCostUsd
      );
    });

    it('should handle failure if depositForUser fails', async () => {
      mockRubicSwapService.executeGasSponsoredSwap.mockResolvedValue(mockSwapResult);
      jest.spyOn(service as any, 'calculateGasCostUsd').mockResolvedValue(calculatedGasCostUsd);
      mockDust2CashEscrowService.depositForUser.mockRejectedValue(new Error('Deposit failed'));

      const result = await service.processGasLoan({
        userAddress: mockUserAddress,
        token: mockToken,
        permitSignature: mockPermitSignature,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Collateral deposit failed: Deposit failed');
    });

    it('should handle token value outside acceptable range', async () => {
      const tokenOutOfRange: TokenWithValue = { ...mockToken, usdValue: 30 };
      const result = await service.processGasLoan({
        userAddress: mockUserAddress,
        token: tokenOutOfRange,
        permitSignature: mockPermitSignature,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('outside acceptable range');
      expect(mockDust2CashEscrowService.depositForUser).not.toHaveBeenCalled();
    });

    // ... other existing test cases like unsupported chain ID, swap failure, etc. can be kept and adapted ...
    // Ensure they also don't call mockDust2CashEscrowService.depositForUser if they fail before that step.

    it('should handle swap failure (no transactionHash)', async () => {
        mockRubicSwapService.executeGasSponsoredSwap.mockResolvedValue({
          ...mockSwapResult,
          transactionHash: undefined,
        });

        const result = await service.processGasLoan({
          userAddress: mockUserAddress,
          token: mockToken,
          permitSignature: mockPermitSignature,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Swap execution failed');
        expect(mockDust2CashEscrowService.depositForUser).not.toHaveBeenCalled();
      });

  });

  describe('getUserLoanStatus', () => {
    it('should get user loan status from Dust2CashEscrowService', async () => {
      const mockUserAddress = '0xUserAddress';
      const mockChainId = '1'; // Chain ID might not be used by D2C Escrow service call but is in method signature
      const mockAccountStatus = {
        escrowedAmount: '100.0',
        outstandingDebt: '10.0',
        reputationScore: 80,
        isBlacklisted: false,
      };
      mockDust2CashEscrowService.getUserAccountStatus.mockResolvedValue(mockAccountStatus);

      const result = await service.getUserLoanStatus(mockUserAddress, mockChainId);

      expect(result).toEqual(expect.objectContaining(mockAccountStatus)); // result includes accountStatus
      expect(mockDust2CashEscrowService.getUserAccountStatus).toHaveBeenCalledWith(mockUserAddress);
    });

    it('should handle errors from Dust2CashEscrowService in getUserLoanStatus', async () => {
      const mockUserAddress = '0xUserAddress';
      const mockChainId = '1';
      mockDust2CashEscrowService.getUserAccountStatus.mockRejectedValue(new Error('Escrow service error'));

      const result = await service.getUserLoanStatus(mockUserAddress, mockChainId);

      expect(result).toEqual({
        escrowedAmount: '0',
        outstandingDebt: '0',
        reputationScore: 0,
        isBlacklisted: false,
      });
    });
  });
});
