import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Dust2CashEscrowService } from './dust2cash-escrow.service';
import { Logger } from '@nestjs/common';

// Mock the ethers library
jest.mock('ethers', () => {
  const originalEthers = jest.requireActual('ethers');
  return {
    ...originalEthers,
    Wallet: jest.fn().mockImplementation(() => ({
      address: '0xMockWalletAddress',
    })),
    Contract: jest.fn().mockImplementation(() => ({
      depositForUser: jest.fn(),
      getUserAccountStatus: jest.fn(),
      getUserAccountStats: jest.fn(),
      on: jest.fn(), // Mock for event listeners
      // Mock other contract methods if needed by tests directly calling them
    })),
    providers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        // Mock provider methods if necessary
      })),
    },
    utils: { // Keep original utils like parseUnits and formatUnits
      ...originalEthers.utils,
    }
  };
});


describe('Dust2CashEscrowService', () => {
  let service: Dust2CashEscrowService;
  let mockContract: ethers.Contract;
  let mockConfigService: ConfigService;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Suppress console.error and console.log during tests for cleaner output
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Dust2CashEscrowService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'PROVIDER_URL') return 'http://localhost:8545';
              if (key === 'PRIVATE_KEY') return '0x0000000000000000000000000000000000000000000000000000000000000001'; // Mock private key
              if (key === 'DUST2CASH_ESCROW_CONTRACT_ADDRESS') return '0xMockEscrowAddress';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<Dust2CashEscrowService>(Dust2CashEscrowService);
    mockConfigService = module.get<ConfigService>(ConfigService);

    // The service constructor creates the contract instance. We can access it if needed,
    // or re-assign `mockContract` to the instance created by the service if preferred.
    // For these tests, we'll rely on the globally mocked ethers.Contract constructor.
    // @ts-ignore
    mockContract = new ethers.Contract(); // This will use the mocked constructor

    // Link the service's contract instance to our mockContract for assertions
    // This assumes the service assigns its created contract to `this.contract`
    // @ts-ignore
    service.contract = mockContract;
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor and initializeEventListeners', () => {
    it('should initialize event listeners', () => {
      // Constructor calls initializeEventListeners
      // Check if contract.on was called for each event
      expect(mockContract.on).toHaveBeenCalledWith('Deposited', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('GasLoanRepaid', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('FundsReleased', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('ReputationUpdated', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('UserBlacklisted', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('UserUnblacklisted', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('ServiceFeeUpdated', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('FeeCollectorUpdated', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledTimes(8); // Ensure all events are covered
    });
  });

  describe('depositForUser', () => {
    it('should call contract.depositForUser with correctly parsed amounts', async () => {
      const user = '0xUserAddress';
      const amount = '100'; // USDC
      const gasDebt = '5';  // USDC
      const mockTxResponse = { hash: '0xTxHashDeposit' };
      (mockContract.depositForUser as jest.Mock).mockResolvedValue(mockTxResponse);

      const result = await service.depositForUser(user, amount, gasDebt);

      expect(mockContract.depositForUser).toHaveBeenCalledWith(
        user,
        ethers.utils.parseUnits(amount, 6),
        ethers.utils.parseUnits(gasDebt, 6)
      );
      expect(result).toEqual(mockTxResponse);
    });

    it('should log appropriate messages for depositForUser', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        const user = '0xUserAddress';
        const amount = '100';
        const gasDebt = '5';
        (mockContract.depositForUser as jest.Mock).mockResolvedValue({ hash: '0xTxHash' });

        await service.depositForUser(user, amount, gasDebt);

        expect(logSpy).toHaveBeenCalledWith(`Attempting to deposit ${amount} USDC for user ${user} with gas debt ${gasDebt}`);
        expect(logSpy).toHaveBeenCalledWith(`Deposit transaction hash: 0xTxHash`);
      });

    it('should handle errors if contract.depositForUser fails', async () => {
      const user = '0xUserAddress';
      const amount = '100';
      const gasDebt = '5';
      const errorMessage = 'Deposit failed';
      (mockContract.depositForUser as jest.Mock).mockRejectedValue(new Error(errorMessage));
      const errorLogSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.depositForUser(user, amount, gasDebt)).rejects.toThrow(errorMessage);
      expect(errorLogSpy).toHaveBeenCalledWith(`Error in depositForUser for ${user}: ${errorMessage}`, expect.any(String));
    });
  });

  describe('getUserAccountStatus', () => {
    it('should return formatted account status', async () => {
      const user = '0xUserAddress';
      const mockStatus = {
        escrowedAmount: ethers.utils.parseUnits('200', 6),
        outstandingDebt: ethers.utils.parseUnits('20', 6),
        reputationScore: BigInt(80), // Use BigInt for ethers v6 if that's what contract returns
        isBlacklisted: false,
      };
      (mockContract.getUserAccountStatus as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.getUserAccountStatus(user);

      expect(mockContract.getUserAccountStatus).toHaveBeenCalledWith(user);
      expect(result).toEqual({
        escrowedAmount: '200.0', // Formatted by ethers.utils.formatUnits
        outstandingDebt: '20.0',  // Formatted by ethers.utils.formatUnits
        reputationScore: 80,      // Converted from BigInt if applicable by .toNumber()
        isBlacklisted: false,
      });
    });

    it('should handle BigNumber for reputationScore if ethers v5 style', async () => {
        const user = '0xUserAddressV5';
        const mockStatusV5 = {
          escrowedAmount: ethers.BigNumber.from(ethers.utils.parseUnits('150', 6)),
          outstandingDebt: ethers.BigNumber.from(ethers.utils.parseUnits('15', 6)),
          reputationScore: ethers.BigNumber.from(75), // ethers.BigNumber for v5
          isBlacklisted: true,
        };
        (mockContract.getUserAccountStatus as jest.Mock).mockResolvedValue(mockStatusV5);

        const result = await service.getUserAccountStatus(user);

        expect(result).toEqual({
          escrowedAmount: '150.0',
          outstandingDebt: '15.0',
          reputationScore: 75, // .toNumber() should handle ethers.BigNumber
          isBlacklisted: true,
        });
      });

    it('should handle errors if contract.getUserAccountStatus fails', async () => {
      const user = '0xUserAddress';
      const errorMessage = 'Failed to fetch status';
      (mockContract.getUserAccountStatus as jest.Mock).mockRejectedValue(new Error(errorMessage));
      const errorLogSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.getUserAccountStatus(user)).rejects.toThrow(errorMessage);
      expect(errorLogSpy).toHaveBeenCalledWith(`Error fetching account status for ${user}: ${errorMessage}`, expect.any(String));
    });
  });

  describe('getUserAccountStats', () => {
    it('should return formatted account stats', async () => {
      const user = '0xUserAddress';
      const mockStats = {
        totalDeposited: ethers.utils.parseUnits('500', 6),
        totalWithdrawn: ethers.utils.parseUnits('300', 6),
        loansRepaid: BigInt(5),
        loansMissed: BigInt(1),
        lastDepositTime: BigInt(Math.floor(new Date('2023-01-01T10:00:00Z').getTime() / 1000)),
      };
      (mockContract.getUserAccountStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getUserAccountStats(user);

      expect(mockContract.getUserAccountStats).toHaveBeenCalledWith(user);
      expect(result).toEqual({
        totalDeposited: '500.0',
        totalWithdrawn: '300.0',
        loansRepaid: 5,
        loansMissed: 1,
        lastDepositTime: new Date('2023-01-01T10:00:00Z'),
      });
    });

    it('should handle ethers.BigNumber for stats if using ethers v5 style', async () => {
        const user = '0xUserAddressV5Stats';
        const v5Timestamp = Math.floor(new Date('2023-02-01T12:00:00Z').getTime() / 1000);
        const mockStatsV5 = {
          totalDeposited: ethers.BigNumber.from(ethers.utils.parseUnits('600', 6)),
          totalWithdrawn: ethers.BigNumber.from(ethers.utils.parseUnits('400', 6)),
          loansRepaid: ethers.BigNumber.from(6),
          loansMissed: ethers.BigNumber.from(2),
          lastDepositTime: ethers.BigNumber.from(v5Timestamp),
        };
        (mockContract.getUserAccountStats as jest.Mock).mockResolvedValue(mockStatsV5);

        const result = await service.getUserAccountStats(user);

        expect(result).toEqual({
          totalDeposited: '600.0',
          totalWithdrawn: '400.0',
          loansRepaid: 6,
          loansMissed: 2,
          lastDepositTime: new Date(v5Timestamp * 1000),
        });
      });

    it('should handle errors if contract.getUserAccountStats fails', async () => {
      const user = '0xUserAddress';
      const errorMessage = 'Failed to fetch stats';
      (mockContract.getUserAccountStats as jest.Mock).mockRejectedValue(new Error(errorMessage));
      const errorLogSpy = jest.spyOn(service['logger'], 'error');

      await expect(service.getUserAccountStats(user)).rejects.toThrow(errorMessage);
      expect(errorLogSpy).toHaveBeenCalledWith(`Error fetching account stats for ${user}: ${errorMessage}`, expect.any(String));
    });
  });

  // Test for getContract and getContractWithUserSigner
  describe('getContract and getContractWithUserSigner', () => {
    it('getContract should return the contract instance', () => {
      expect(service.getContract()).toBe(mockContract);
    });

    it('getContractWithUserSigner should return a new contract instance with user signer', () => {
      const userPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000002';
      const userContractInstance = service.getContractWithUserSigner(userPrivateKey);
      expect(ethers.Contract).toHaveBeenCalledWith(mockContract.address, expect.any(Array), expect.any(ethers.Wallet));
      expect(userContractInstance).toBeDefined();
      // Check if the wallet passed to Contract constructor was created with userPrivateKey
      const walletArgs = (ethers.Wallet as jest.Mock).mock.calls.find(call => call[0] === userPrivateKey);
      expect(walletArgs).toBeDefined();
    });

    it('getContractWithUserSigner should throw if no private key', () => {
      expect(() => service.getContractWithUserSigner('')).toThrow("User's private key is required.");
    });
  });

});
