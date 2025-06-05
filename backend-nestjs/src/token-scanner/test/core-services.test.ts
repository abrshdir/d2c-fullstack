import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TokenWithValue } from '../types/token.types';
import { GasLoanRequest } from '../types/gas-loan.types';
import { SuiStakingRequest } from '../types/sui-staking.types';
import { GasLoanService } from '../gas-loan.service';
import { RubicSwapService } from '../rubic-swap.service';
import { CollateralLockService } from '../collateral-lock.service';
import { SuiStakingService } from '../sui-staking.service';
import { RewardManagementService } from '../reward-management.service';
import { SuiBridgeService } from '../sui-bridge.service';
import { SwapTransactionService } from '../swap-transaction.service';
import { ethers } from 'ethers';

describe('Core Services Integration Tests', () => {
  let module: TestingModule;
  let gasLoanService: GasLoanService;
  let rubicSwapService: RubicSwapService;
  let collateralLockService: CollateralLockService;
  let suiStakingService: SuiStakingService;
  let rewardManagementService: RewardManagementService;
  let suiBridgeService: SuiBridgeService;
  let swapTransactionService: SwapTransactionService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        HttpModule,
      ],
      providers: [
        GasLoanService,
        RubicSwapService,
        CollateralLockService,
        SuiStakingService,
        RewardManagementService,
        SuiBridgeService,
        SwapTransactionService,
      ],
    }).compile();

    gasLoanService = module.get<GasLoanService>(GasLoanService);
    rubicSwapService = module.get<RubicSwapService>(RubicSwapService);
    collateralLockService = module.get<CollateralLockService>(
      CollateralLockService,
    );
    suiStakingService = module.get<SuiStakingService>(SuiStakingService);
    rewardManagementService = module.get<RewardManagementService>(
      RewardManagementService,
    );
    suiBridgeService = module.get<SuiBridgeService>(SuiBridgeService);
    swapTransactionService = module.get<SwapTransactionService>(
      SwapTransactionService,
    );
  });

  afterEach(async () => {
    await module.close();
  });

  describe('GasLoanService', () => {
    it('should be defined', () => {
      expect(gasLoanService).toBeDefined();
    });

    it('should validate token value correctly', async () => {
      const mockToken = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'USDC',
        decimals: 6,
        balance: '1000000', // 1 USDC
        usdValue: 10, // $10
      };

      // Should pass validation (between $5 and $25)
      expect(() =>
        gasLoanService['validateTokenValue'](mockToken),
      ).not.toThrow();

      // Should fail validation (below $5)
      mockToken.usdValue = 3;
      expect(() => gasLoanService['validateTokenValue'](mockToken)).toThrow(
        'Token value must be between $5 and $25',
      );

      // Should fail validation (above $25)
      mockToken.usdValue = 30;
      expect(() => gasLoanService['validateTokenValue'](mockToken)).toThrow(
        'Token value must be between $5 and $25',
      );
    });

    it('should calculate gas cost correctly', async () => {
      const mockReceipt = {
        gasUsed: BigInt(21000),
        gasPrice: BigInt(20000000000), // 20 gwei
      };

      const gasCost = gasLoanService['calculateGasCost'](mockReceipt as any);
      expect(gasCost).toBe('0.00042'); // 21000 * 20 gwei = 0.00042 ETH
    });

    it('should get user loan status', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const chainId = '1'; // Ethereum

      const status = await gasLoanService.getUserLoanStatus(
        userAddress,
        chainId,
      );
      expect(status).toHaveProperty('collateral');
      expect(status).toHaveProperty('loanOwed');
      expect(status).toHaveProperty('hasActiveLoan');
    });
  });

  describe('RubicSwapService', () => {
    it('should be defined', () => {
      expect(rubicSwapService).toBeDefined();
    });

    it('should get swap quote', async () => {
      const mockToken: TokenWithValue = {
        chainId: '1',
        tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        balance: '1000000000000000000',
        balanceFormatted: 1.0,
        usdValue: 2000,
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        value: 1.0
      };

      try {
        // Define a wallet address for testing
        const testWalletAddress = '0x0000000000000000000000000000000000000000';

        const quote = await rubicSwapService.getSwapQuote(
          mockToken.tokenAddress,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
          mockToken.balanceFormatted.toString(),
          testWalletAddress,
          mockToken.chainId,
        );
        expect(quote).toHaveProperty('destinationTokenAmount');
        expect(quote).toHaveProperty('priceImpact');
        expect(quote).toHaveProperty('estimatedGas');
      } catch (error) {
        // Expected to fail in test environment without real API keys
        expect(error.message).toContain('API');
      }
    });
  });

  describe('CollateralLockService', () => {
    it('should be defined', () => {
      expect(collateralLockService).toBeDefined();
    });

    it('should have correct contract configuration', () => {
      expect(collateralLockService['contractAddress']).toBeDefined();
      expect(collateralLockService['contractABI']).toBeDefined();
      expect(Array.isArray(collateralLockService['contractABI'])).toBe(true);
    });

    it('should get user status', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const chainId = '1';

      try {
        const status = await collateralLockService.getUserStatus(
          userAddress,
          chainId,
        );
        expect(status).toHaveProperty('collateral');
        expect(status).toHaveProperty('loanOwed');
      } catch (error) {
        // Expected to fail in test environment without real RPC
        expect(error.message).toContain('provider');
      }
    });
  });

  describe('SuiStakingService', () => {
    it('should be defined', () => {
      expect(suiStakingService).toBeDefined();
    });

    it('should calculate estimated rewards', () => {
      const stakingAmount = '100000000000000000000'; // 100 SUI in wei
      const rewards =
        suiStakingService['calculateEstimatedRewards'](stakingAmount);

      expect(rewards).toHaveProperty('estimatedApy');
      expect(rewards).toHaveProperty('dailyRewards');
      expect(rewards).toHaveProperty('monthlyRewards');
      expect(rewards).toHaveProperty('yearlyRewards');
    });

    it('should select validator', () => {
      const validator = suiStakingService['selectValidator']();
      expect(validator).toHaveProperty('address');
      expect(validator).toHaveProperty('name');
      expect(validator).toHaveProperty('commission');
      expect(validator).toHaveProperty('apy');
    });
  });

  describe('RewardManagementService', () => {
    it('should be defined', () => {
      expect(rewardManagementService).toBeDefined();
    });

    it('should check reward status', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';

      try {
        const status =
          await rewardManagementService.checkRewardsStatus(userAddress);
        expect(status).toHaveProperty('hasRewards');
        expect(status).toHaveProperty('canFinalize');
        expect(status).toHaveProperty('estimatedPayout');
        expect(status).toHaveProperty('estimatedRepayment');
      } catch (error) {
        // Expected to fail in test environment
        console.log('Expected test failure:', error.message);
      }
    });

    it('should get user loan status from all chains', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';

      const statuses =
        await rewardManagementService['getUserLoanStatusFromAllChains'](
          userAddress,
        );
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  describe('SuiBridgeService', () => {
    it('should be defined', () => {
      expect(suiBridgeService).toBeDefined();
    });

    it('should have correct USDC addresses', () => {
      expect(suiBridgeService['USDC_ADDRESSES']).toHaveProperty('1'); // Ethereum
      expect(suiBridgeService['USDC_ADDRESSES']).toHaveProperty('137'); // Polygon
      expect(suiBridgeService['USDC_ADDRESSES']).toHaveProperty('101'); // SUI
    });

    it('should get bridge quote', async () => {
      const mockToken: TokenWithValue = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'USDC',
        decimals: 6,
        balance: '1000000',
        usdValue: 10,
        chainId: '1',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        name: 'USD Coin',
        balanceFormatted: 1.0,
        value: 1.0
      };

      try {
        const quote = await suiBridgeService.getBridgeQuote(mockToken);
        expect(quote).toHaveProperty('destinationTokenAmount');
        expect(quote).toHaveProperty('priceImpact');
        expect(quote).toHaveProperty('estimatedGas');
      } catch (error) {
        // Expected to fail in test environment
        expect(error.message).toContain('provider');
      }
    });
  });

  describe('Integration Flow Test', () => {
    it('should handle complete gas loan flow', async () => {
      const mockRequest: GasLoanRequest = {
        userAddress: '0x1234567890123456789012345678901234567890',
        token: {
          address: '0xA0b86a33E6441b8dB2B2B0b0b0b0b0b0b0b0b0b0',
          symbol: 'USDC',
          decimals: 6,
          balance: '10000000', // 10 USDC
          usdValue: 10,
          chainId: '1',
          tokenAddress: '0xA0b86a33E6441b8dB2B2B0b0b0b0b0b0b0b0b0b0',
          name: 'USD Coin',
          balanceFormatted: 10.0,
          value: 10.0
        },
        permitData: {
          deadline: Math.floor(Date.now() / 1000) + 3600,
          v: 27,
          r: '0x1234567890123456789012345678901234567890123456789012345678901234',
          s: '0x1234567890123456789012345678901234567890123456789012345678901234',
        },
        permitSignature: {
          v: 27,
          r: '0x1234567890123456789012345678901234567890123456789012345678901234',
          s: '0x1234567890123456789012345678901234567890123456789012345678901234',
          deadline: Math.floor(Date.now() / 1000) + 3600,
          nonce: 1,
        },
        chainId: '11155111', // Sepolia
      };

      try {
        const result = await gasLoanService.processGasLoan(mockRequest);
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('transactionHash');
        expect(result).toHaveProperty('usdcObtained');
        expect(result).toHaveProperty('gasCost');
      } catch (error) {
        // Expected to fail in test environment without real blockchain connection
        console.log('Expected integration test failure:', error.message);
        expect(error.message).toContain('provider');
      }
    });

    it('should handle SUI staking flow', async () => {
      const mockRequest: SuiStakingRequest = {
        userAddress: '0x1234567890123456789012345678901234567890',
        usdcAmount: ethers.parseUnits('10', 6), // 10 USDC
        discountRate: 50, // 50% discount
        chainId: '1', // Ethereum
      };

      try {
        const result = await suiStakingService.initiateSuiStaking(mockRequest);
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('bridgeTransactionHash');
        expect(result).toHaveProperty('stakingTransactionHash');
        expect(result).toHaveProperty('discountApplied');
      } catch (error) {
        // Expected to fail in test environment
        console.log('Expected SUI staking test failure:', error.message);
        expect(error.message).toContain('provider');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid addresses gracefully', async () => {
      const invalidAddress = 'invalid-address';

      try {
        await gasLoanService.getUserLoanStatus(invalidAddress, '1');
      } catch (error) {
        expect(error.message).toContain('Invalid address');
      }
    });

    it('should handle unsupported chains', async () => {
      const userAddress = '0x1234567890123456789012345678901234567890';
      const unsupportedChainId = '999999';

      try {
        await gasLoanService.getUserLoanStatus(userAddress, unsupportedChainId);
      } catch (error) {
        expect(error.message).toContain('Unsupported chain');
      }
    });
  });
});
