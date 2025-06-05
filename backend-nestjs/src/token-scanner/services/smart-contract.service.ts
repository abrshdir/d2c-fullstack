import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { Contract, BaseContract } from 'ethers';

// Import contract ABIs
const Dust2CashEscrowABI = require('../../../../smart-contracts/artifacts/contracts/Dust2CashEscrow.sol/Dust2CashEscrow.json');
const RubicSwapExecutorABI = require('../../../../smart-contracts/artifacts/contracts/RubicSwapExecutor.sol/SwapExecutor.json');
const CollateralLockABI = require('../../../../smart-contracts/artifacts/contracts/CollateralLock.sol/CollateralLock.json');
const TreasuryABI = require('../../../../smart-contracts/artifacts/contracts/Treasury.sol/Treasury.json');

// Define contract interfaces
interface IEscrowContract extends BaseContract {
  depositForUser: (userAddress: string, amount: bigint, gasDebt: bigint) => Promise<ethers.ContractTransactionResponse>;
  repayGasLoan: (userAddress: string, amount: bigint) => Promise<ethers.ContractTransactionResponse>;
  getUserAccount: (userAddress: string) => Promise<{ reputationScore: number }>;
}

interface ISwapExecutorContract extends BaseContract {
  executeSwap: (fromToken: string, toToken: string, amount: bigint, quoteId: string, swapData: string) => Promise<ethers.ContractTransactionResponse>;
}

interface ICollateralLockContract extends BaseContract {
  stakeOnSui: (discountRate: number) => Promise<ethers.ContractTransactionResponse>;
}

interface ITreasuryContract extends BaseContract {
  finalizeRewards: (userAddress: string, repayAmount: bigint, payoutAmount: bigint) => Promise<ethers.ContractTransactionResponse>;
  fundRelayer: (amount: bigint) => Promise<ethers.ContractTransactionResponse>;
  collectFees: () => Promise<ethers.ContractTransactionResponse>;
}

@Injectable()
export class SmartContractService {
  private readonly logger = new Logger(SmartContractService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet;
  private readonly escrowContract: IEscrowContract;
  private readonly swapExecutorContract: ISwapExecutorContract;
  private readonly collateralLockContract: ICollateralLockContract;
  private readonly treasuryContract: ITreasuryContract;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('ETHEREUM_RPC_URL');
    const privateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY');

    if (!rpcUrl || !privateKey) {
      throw new Error('ETHEREUM_RPC_URL and RELAYER_PRIVATE_KEY must be set');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    // Initialize contracts
    const escrowAddress = this.configService.get<string>('ESCROW_CONTRACT_ADDRESS');
    if (!escrowAddress) {
      throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
    }
    this.escrowContract = new ethers.Contract(escrowAddress, Dust2CashEscrowABI.abi, this.wallet) as unknown as IEscrowContract;

    const swapExecutorAddress = this.configService.get<string>('SWAP_EXECUTOR_CONTRACT_ADDRESS');
    if (!swapExecutorAddress) {
      throw new Error('SWAP_EXECUTOR_CONTRACT_ADDRESS not configured');
    }
    this.swapExecutorContract = new ethers.Contract(swapExecutorAddress, RubicSwapExecutorABI.abi, this.wallet) as unknown as ISwapExecutorContract;

    const collateralLockAddress = this.configService.get<string>('COLLATERAL_LOCK_CONTRACT_ADDRESS');
    if (!collateralLockAddress) {
      throw new Error('COLLATERAL_LOCK_CONTRACT_ADDRESS not configured');
    }
    this.collateralLockContract = new ethers.Contract(collateralLockAddress, CollateralLockABI.abi, this.wallet) as unknown as ICollateralLockContract;

    const treasuryAddress = this.configService.get<string>('TREASURY_CONTRACT_ADDRESS');
    if (!treasuryAddress) {
      throw new Error('TREASURY_CONTRACT_ADDRESS not configured');
    }
    this.treasuryContract = new ethers.Contract(treasuryAddress, TreasuryABI.abi, this.wallet) as unknown as ITreasuryContract;
  }

  async sendTransaction(transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  }) {
    try {
      const tx = {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: transaction.gasLimit,
      };

      const response = await this.wallet.sendTransaction(tx);
      this.logger.log(`Transaction sent: ${response.hash}`);
      return response;
    } catch (error) {
      this.logger.error(`Error sending transaction: ${error.message}`);
      throw error;
    }
  }

  async depositForUser(userAddress: string, amount: bigint, gasDebt: bigint) {
    return await this.escrowContract.depositForUser(userAddress, amount, gasDebt);
  }

  async repayGasLoan(userAddress: string, amount: bigint) {
    return await this.escrowContract.repayGasLoan(userAddress, amount);
  }

  async getUserAccount(userAddress: string) {
    return await this.escrowContract.getUserAccount(userAddress);
  }

  async executeSwap(fromToken: string, toToken: string, amount: bigint, quoteId: string, swapData: string) {
    return await this.swapExecutorContract.executeSwap(fromToken, toToken, amount, quoteId, swapData);
  }

  async stakeOnSui(discountRate: number) {
    return await this.collateralLockContract.stakeOnSui(discountRate);
  }

  async finalizeRewards(userAddress: string, repayAmount: bigint, payoutAmount: bigint) {
    return await this.treasuryContract.finalizeRewards(userAddress, repayAmount, payoutAmount);
  }

  async fundRelayer(amount: bigint) {
    return await this.treasuryContract.fundRelayer(amount);
  }

  async collectFees() {
    return await this.treasuryContract.collectFees();
  }

  getSwapEventTopic(): string {
    if (!this.swapExecutorContract?.interface) {
      throw new Error('Swap executor contract interface not initialized');
    }
    const event = this.swapExecutorContract.interface.getEvent('SwapExecuted');
    if (!event) {
      throw new Error('SwapExecuted event not found in contract interface');
    }
    return event.topicHash;
  }

  parseSwapEvent(event: any): any {
    return this.swapExecutorContract.interface.parseLog(event);
  }
} 