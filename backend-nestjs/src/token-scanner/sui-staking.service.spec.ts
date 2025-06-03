import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SuiStakingService, SuiStakingResult } from './sui-staking.service';
import { SuiBridgeService, BridgeStatus } from './sui-bridge.service';
import { CollateralLockService } from './collateral-lock.service';
import { Dust2CashEscrowService } from './services/dust2cash-escrow.service';
import { SuiStakingRequest } from '../types/sui-staking.types';
import { Logger } from '@nestjs/common';

// Mocks
const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    if (key === 'SUI_RPC_URL') return 'https://sui-rpc.example.com';
    if (key === 'SUI_RELAYER_PRIVATE_KEY') return '0xMockSuiPrivateKey';
    // Add other config keys if needed during tests
    return defaultValue;
  }),
};

const mockHttpService = {
  // Mock methods used by SuiStakingService if any (e.g., for DEX interaction if not fully mocked)
  // For now, assuming direct DEX calls are minimal or mocked within functions
};

const mockSuiBridgeService = {
  executeGasSponsoredBridge: jest.fn(),
  checkBridgeStatus: jest.fn(),
  getBridgeDetails: jest.fn(),
  getBridgeQuote: jest.fn(), // Added if bridgeUsdcToSui calls it
};

const mockCollateralLockService = {
  applyStakingDiscount: jest.fn(), // Though deprecated, it was in the original code path
  finalizeRewards: jest.fn(),
  // Add other methods if they are still somehow used or if constructor needs them
};

const mockDust2CashEscrowService = {
  getUserAccountStatus: jest.fn(),
};

describe('SuiStakingService', () => {
  let service: SuiStakingService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuiStakingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: SuiBridgeService, useValue: mockSuiBridgeService },
        { provide: CollateralLockService, useValue: mockCollateralLockService },
        { provide: Dust2CashEscrowService, useValue: mockDust2CashEscrowService },
      ],
    }).compile();

    service = module.get<SuiStakingService>(SuiStakingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateSuiStaking', () => {
    const mockUserAddress = '0xUserAddress';
    const mockChainId = '1';
    const mockUsdcAmountToStake = '100.0';

    const baseRequest: SuiStakingRequest = {
      userAddress: mockUserAddress,
      usdcAmountToStake: mockUsdcAmountToStake,
      chainId: mockChainId,
      discountRate: 0, // Kept for DTO compatibility, though not used for discount
    };

    it('should return success: false if user has outstanding debt', async () => {
      mockDust2CashEscrowService.getUserAccountStatus.mockResolvedValue({
        outstandingDebt: '10.0', // User has debt
        escrowedAmount: '100.0',
        reputationScore: 70,
        isBlacklisted: false,
      });

      const result = await service.initiateSuiStaking(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Outstanding debt of 10.0 USDC must be repaid');
      expect(mockSuiBridgeService.executeGasSponsoredBridge).not.toHaveBeenCalled();
    });

    it('should return success: false if usdcAmountToStake is invalid', async () => {
        const invalidRequest: SuiStakingRequest = { ...baseRequest, usdcAmountToStake: '0' };
        const result = await service.initiateSuiStaking(invalidRequest);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid USDC amount to stake.');
      });

    describe('when user has no debt and valid amount', () => {
      beforeEach(() => {
        // Common setup for successful path
        mockDust2CashEscrowService.getUserAccountStatus.mockResolvedValue({
          outstandingDebt: '0',
          escrowedAmount: '0', // Escrowed amount is irrelevant here as user stakes from their own wallet
          reputationScore: 70,
          isBlacklisted: false,
        });

        // Mock internal methods that are called in sequence
        // bridgeUsdcToSui (which calls suiBridgeService.executeGasSponsoredBridge)
        // For simplicity, directly mock what bridgeUsdcToSui would return, or mock its sub-calls
        // Here, we mock the sub-calls made by the internal bridgeUsdcToSui
         mockSuiBridgeService.getBridgeQuote.mockResolvedValue({ /* mock quote data */ } as any);
         mockSuiBridgeService.executeGasSponsoredBridge.mockResolvedValue({
            success: true,
            transactionHash: '0xBridgeTxHash',
            // other fields from BridgeResult
         } as any);

        // Spy on private methods or mock their results if they make external calls
        jest.spyOn(service as any, 'waitForBridgeCompletion').mockResolvedValue('99.0'); // Mock SUI USDC amount after bridge
        jest.spyOn(service as any, 'swapUsdcToSui').mockResolvedValue('98.0'); // Mock SUI amount after swap
        jest.spyOn(service as any, 'stakeSuiWithValidator').mockResolvedValue({
          success: true,
          transactionHash: '0xSuiStakeTxHash',
          validatorAddress: '0xMockValidator',
        });
        jest.spyOn(service as any, 'calculateEstimatedRewards').mockReturnValue('0.5');
      });

      it('should process staking successfully with no debt and valid amount', async () => {
        const result = await service.initiateSuiStaking(baseRequest);

        expect(result.success).toBe(true);
        expect(result.bridgeTransactionHash).toBe('0xBridgeTxHash');
        expect(result.suiStakingTransactionHash).toBe('0xSuiStakeTxHash');
        expect(result.stakedAmount).toBe('98.0'); // from mocked swapUsdcToSui
        expect(result.validatorAddress).toBe('0xMockValidator');
        expect(result.estimatedRewards).toBe('0.5');

        expect(mockDust2CashEscrowService.getUserAccountStatus).toHaveBeenCalledWith(mockUserAddress);
        // bridgeUsdcToSui is private, check its effects via suiBridgeService calls
        expect(mockSuiBridgeService.executeGasSponsoredBridge).toHaveBeenCalledWith(
            expect.objectContaining({
                balanceFormatted: parseFloat(mockUsdcAmountToStake), // Check amount passed to bridge
                chainId: mockChainId,
            }),
            mockUserAddress,
            mockUserAddress // Assuming destination is same as source for SUI address
        );
        expect(service['waitForBridgeCompletion']).toHaveBeenCalledWith('0xBridgeTxHash', mockUserAddress);
        expect(service['swapUsdcToSui']).toHaveBeenCalledWith('99.0'); // Amount from waitForBridgeCompletion
        expect(service['stakeSuiWithValidator']).toHaveBeenCalledWith('98.0', mockUserAddress); // Amount from swapUsdcToSui
        expect(mockCollateralLockService.applyStakingDiscount).not.toHaveBeenCalled(); // Ensure discount is NOT applied
      });

      it('should handle bridge failure', async () => {
        mockSuiBridgeService.executeGasSponsoredBridge.mockResolvedValue({
            success: false,
            error: 'Bridge execution failed in test',
        } as any);

        const result = await service.initiateSuiStaking(baseRequest);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Bridge to SUI failed: Bridge execution failed in test');
      });

      it('should handle waitForBridgeCompletion failure (returns null)', async () => {
        jest.spyOn(service as any, 'waitForBridgeCompletion').mockResolvedValue(null);
        const result = await service.initiateSuiStaking(baseRequest);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Bridge completion failed or timed out');
      });

      it('should handle swapUsdcToSui failure (returns null)', async () => {
        jest.spyOn(service as any, 'swapUsdcToSui').mockResolvedValue(null);
        const result = await service.initiateSuiStaking(baseRequest);
        expect(result.success).toBe(false);
        expect(result.error).toBe('USDC to SUI swap failed');
      });

      it('should handle stakeSuiWithValidator failure', async () => {
        jest.spyOn(service as any, 'stakeSuiWithValidator').mockResolvedValue({
          success: false,
          error: 'SUI staking failed in validator step',
        });
        const result = await service.initiateSuiStaking(baseRequest);
        expect(result.success).toBe(false);
        expect(result.error).toBe('SUI staking failed: SUI staking failed in validator step');
      });
    });
  });
});
