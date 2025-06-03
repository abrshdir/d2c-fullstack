import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as escrowAbi from './dust2cash-escrow.abi.json'; // Assuming ABI is stored here

@Injectable()
export class Dust2CashEscrowService {
  private readonly logger = new Logger(Dust2CashEscrowService.name);
  private contract: ethers.Contract;
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet; // Required for onlyOwner functions like depositForUser

  constructor(private configService: ConfigService) {
    const providerUrl = this.configService.get<string>('PROVIDER_URL');
    const privateKey = this.configService.get<string>('PRIVATE_KEY');
    const escrowContractAddress = this.configService.get<string>(
      'DUST2CASH_ESCROW_CONTRACT_ADDRESS',
      '0xremplacerAvecNouvelleAdresseEscrow', // Default placeholder
    );

    if (!providerUrl || !privateKey) {
      this.logger.error('Provider URL or Private Key is not configured.');
      throw new Error('Provider URL or Private Key is not configured.');
    }

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      escrowContractAddress,
      escrowAbi,
      this.wallet, // Use wallet for sending transactions
    );

    this.logger.log(
      `Dust2CashEscrowService initialized with contract address: ${escrowContractAddress}`,
    );
    this.initializeEventListeners(); // Call to setup event listeners
  }

  private initializeEventListeners(): void {
    this.logger.log('Initializing Dust2CashEscrow event listeners...');

    this.contract.on('Deposited', (user, amount, gasDebt, event) => {
      this.logger.log(
        `EVENT Deposited: User=${user}, Amount=${ethers.utils.formatUnits(amount, 6)} USDC, GasDebt=${ethers.utils.formatUnits(gasDebt, 6)} USDC, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('GasLoanRepaid', (user, amount, event) => {
      this.logger.log(
        `EVENT GasLoanRepaid: User=${user}, AmountRepaid=${ethers.utils.formatUnits(amount, 6)} USDC, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('FundsReleased', (user, amount, event) => {
      this.logger.log(
        `EVENT FundsReleased: User=${user}, AmountReleased=${ethers.utils.formatUnits(amount, 6)} USDC, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('ReputationUpdated', (user, newScore, event) => {
      this.logger.log(
        `EVENT ReputationUpdated: User=${user}, NewScore=${newScore.toString()}, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('UserBlacklisted', (user, until, event) => {
      this.logger.log(
        `EVENT UserBlacklisted: User=${user}, Until=${new Date(until.toNumber() * 1000).toISOString()}, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('UserUnblacklisted', (user, event) => {
      this.logger.log(
        `EVENT UserUnblacklisted: User=${user}, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('ServiceFeeUpdated', (newRate, event) => {
      this.logger.log(
        `EVENT ServiceFeeUpdated: NewRate=${newRate.toString()} bps, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.contract.on('FeeCollectorUpdated', (newCollector, event) => {
      this.logger.log(
        `EVENT FeeCollectorUpdated: NewCollector=${newCollector}, TxHash=${event.transactionHash} @ ${new Date().toISOString()}`
      );
    });

    this.logger.log('Dust2CashEscrow event listeners initialized.');
  }

  /**
   * Deposits USDC into escrow for a user and records their gas debt.
   * This function can only be called by the contract owner.
   */
  async depositForUser(
    user: string,
    amount: string,
    gasDebt: string,
  ): Promise<ethers.providers.TransactionResponse> {
    try {
      this.logger.log(
        `Attempting to deposit ${amount} USDC for user ${user} with gas debt ${gasDebt}`,
      );
      const tx = await this.contract.depositForUser(user, ethers.utils.parseUnits(amount, 6), ethers.utils.parseUnits(gasDebt, 6));
      this.logger.log(`Deposit transaction hash: ${tx.hash}`);
      return tx;
    } catch (error) {
      this.logger.error(`Error in depositForUser for ${user}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Allows a user to repay their gas loan.
   * Note: This must be called by the user (msg.sender) from their wallet.
   * The backend might provide the amount or facilitate the transaction creation.
   */
  async repayGasLoan(
    user: string, // User address, for logging or if contract changes
    amount: string,
  ): Promise<ethers.providers.TransactionResponse> {
    // This function is called by the user, so the 'contract' instance should be
    // connected to the user's signer, not the backend's wallet.
    // This example assumes the backend is triggering it, which is incorrect for this specific contract function.
    // For now, logging and throwing an error or providing info.
    this.logger.warn(
      `repayGasLoan should be called by the user ${user} directly. Backend is simulating call for amount ${amount}.`,
    );
    // To actually execute this from backend (if it were possible, e.g., contract allows any sender to pay for user):
    // const tx = await this.contract.repayGasLoan(ethers.utils.parseUnits(amount, 6));
    // return tx;
    throw new Error(
      'repayGasLoan must be called by the user directly from their wallet connected to the DApp.',
    );
  }

  /**
   * Allows a user to withdraw their funds.
   * Note: This must be called by the user (msg.sender).
   * The backend can provide information about withdrawable amounts.
   */
  async withdrawFunds(user: string): Promise<ethers.providers.TransactionResponse> {
    this.logger.warn(
      `withdrawFunds should be called by the user ${user} directly.`,
    );
    throw new Error(
      'withdrawFunds must be called by the user directly from their wallet connected to the DApp.',
    );
  }

  /**
   * Gets the account status for a given user.
   */
  async getUserAccountStatus(user: string): Promise<{
    escrowedAmount: string;
    outstandingDebt: string;
    reputationScore: number;
    isBlacklisted: boolean;
  }> {
    try {
      const status = await this.contract.getUserAccountStatus(user);
      return {
        escrowedAmount: ethers.utils.formatUnits(status.escrowedAmount, 6),
        outstandingDebt: ethers.utils.formatUnits(status.outstandingDebt, 6),
        reputationScore: status.reputationScore.toNumber(),
        isBlacklisted: status.isBlacklisted,
      };
    } catch (error) {
      this.logger.error(`Error fetching account status for ${user}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Gets detailed account statistics for a given user.
   */
  async getUserAccountStats(user: string): Promise<{
    totalDeposited: string;
    totalWithdrawn: string;
    loansRepaid: number;
    loansMissed: number;
    lastDepositTime: Date;
  }> {
    try {
      const stats = await this.contract.getUserAccountStats(user);
      return {
        totalDeposited: ethers.utils.formatUnits(stats.totalDeposited, 6),
        totalWithdrawn: ethers.utils.formatUnits(stats.totalWithdrawn, 6),
        loansRepaid: stats.loansRepaid.toNumber(),
        loansMissed: stats.loansMissed.toNumber(),
        lastDepositTime: new Date(stats.lastDepositTime.toNumber() * 1000),
      };
    } catch (error) {
      this.logger.error(`Error fetching account stats for ${user}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Consider adding helper functions that the frontend might need, for example:
  // - estimateGasForRepayLoan(user: string, amount: string)
  // - estimateGasForWithdrawFunds(user: string)
  // These would use provider.estimateGas and contract.populateTransaction.

  /**
   * Helper to get the contract instance if needed externally (e.g. for user-signed txns)
   * This would typically be used by a part of the backend that prepares transactions for the user to sign.
   */
  getContract(): ethers.Contract {
    return this.contract;
  }

   /**
   * Creates a new contract instance with a user's signer.
   * This is necessary for functions like repayGasLoan and withdrawFunds that require msg.sender to be the user.
   * The frontend would send a signed transaction, or the backend would need the user's private key (unsafe).
   * A more secure approach involves the backend preparing the transaction data, and the user signing it with their wallet.
   *
   * @param userPrivateKey The user's private key. CAUTION: Handling private keys on the backend is risky.
   * @returns A contract instance connected to the user's wallet.
   */
  getContractWithUserSigner(userPrivateKey: string): ethers.Contract {
    if (!userPrivateKey) {
      throw new Error("User's private key is required.");
    }
    const userWallet = new ethers.Wallet(userPrivateKey, this.provider);
    return new ethers.Contract(this.contract.address, escrowAbi, userWallet);
  }
}
