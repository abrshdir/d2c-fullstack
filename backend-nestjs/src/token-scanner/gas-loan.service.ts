import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { TokenWithValue } from './token-scanner.service';
import { RubicSwapService, SwapResult } from './rubic-swap.service';
import { CollateralLockService } from './collateral-lock.service';
import { SmartContractService } from './services/smart-contract.service';
import { DatabaseService } from './services/database.service';

export interface GasLoanRequest {
  userAddress: string;
  token: TokenWithValue;
  permitSignature: {
    v: number;
    r: string;
    s: string;
    deadline: number;
    nonce: number;
  };
}

export interface GasLoanResult {
  success: boolean;
  transactionHash?: string;
  usdcObtained?: string;
  gasCostUsd?: string;
  loanAmount?: string;
  error?: string;
}

@Injectable()
export class GasLoanService {
  private readonly logger = new Logger(GasLoanService.name);
  private readonly relayerPrivateKey: string;
  private readonly providers: Map<string, ethers.JsonRpcProvider> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly rubicSwapService: RubicSwapService,
    private readonly collateralLockService: CollateralLockService,
    private readonly smartContractService: SmartContractService,
    private readonly databaseService: DatabaseService,
  ) {
    this.relayerPrivateKey = this.configService.get<string>(
      'RELAYER_PRIVATE_KEY',
      '',
    );

    // Initialize providers for supported chains
    this.initializeProviders();
  }

  private initializeProviders() {
    const chains = [
      { id: '1', rpc: this.configService.get<string>('ETHEREUM_RPC_URL') },
      {
        id: '11155111',
        rpc: this.configService.get<string>('SEPOLIA_RPC_URL'),
      },
      { id: '8453', rpc: this.configService.get<string>('BASE_RPC_URL') },
      { id: '42161', rpc: this.configService.get<string>('ARBITRUM_RPC_URL') },
      { id: '10', rpc: this.configService.get<string>('OPTIMISM_RPC_URL') },
    ];

    chains.forEach((chain) => {
      if (chain.rpc) {
        this.providers.set(chain.id, new ethers.JsonRpcProvider(chain.rpc));
      }
    });
  }

  /**
   * Process the complete gas loan flow:
   * 1. Execute permit to allow relayer to spend user's tokens
   * 2. Swap tokens to USDC via Rubic
   * 3. Lock collateral in smart contract
   * 4. Calculate and record loan amount
   */
  async processGasLoan(request: GasLoanRequest): Promise<GasLoanResult> {
    try {
      this.logger.log(`Processing gas loan for user: ${request.userAddress}`);

      // Validate token value is within acceptable range ($5-$25)
      if (request.token.usdValue < 5 || request.token.usdValue > 25) {
        return {
          success: false,
          error: `Token value $${request.token.usdValue} is outside acceptable range ($5-$25)`,
        };
      }

      const provider = this.providers.get(request.token.chainId);
      if (!provider) {
        return {
          success: false,
          error: `Unsupported chain ID: ${request.token.chainId}`,
        };
      }

      const relayerWallet = new ethers.Wallet(this.relayerPrivateKey, provider);

      // Step 1: Execute permit transaction
      const permitResult = await this.executePermit(
        relayerWallet,
        request.token,
        request.permitSignature,
      );

      if (!permitResult.success) {
        return {
          success: false,
          error: `Permit execution failed: ${permitResult.error}`,
        };
      }

      // Step 2: Swap tokens to USDC via Rubic
      const swapResult = await this.rubicSwapService.executeGasSponsoredSwap(
        request.token,
        request.userAddress,
      );

      if (!swapResult.transactionHash) {
        return {
          success: false,
          error: 'Swap execution failed',
        };
      }

      // Step 3: Calculate gas cost in USD with accurate gas price data
      const gasCostUsd = await this.calculateGasCostUsd(
        swapResult.transactionHash,
        request.token.chainId,
      );

      // Step 4: Lock collateral in smart contract
      const lockResult = await this.collateralLockService.lockCollateralWithWallet(
        request.userAddress,
        swapResult.usdcObtained,
        gasCostUsd,
        relayerWallet,
      );

      if (!lockResult.success) {
        return {
          success: false,
          error: `Collateral lock failed: ${lockResult.error}`,
        };
      }

      this.logger.log(
        `Gas loan processed successfully for user: ${request.userAddress}`,
      );

      return {
        success: true,
        transactionHash: swapResult.transactionHash,
        usdcObtained: swapResult.usdcObtained,
        gasCostUsd: gasCostUsd,
        loanAmount: gasCostUsd,
      };
    } catch (error) {
      this.logger.error(
        `Gas loan processing failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute EIP-2612 permit transaction
   */
  private async executePermit(
    relayerWallet: ethers.Wallet,
    token: TokenWithValue,
    signature: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // ERC20 permit function ABI
      const permitAbi = [
        'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
      ];

      const tokenContract = new ethers.Contract(
        token.tokenAddress,
        permitAbi,
        relayerWallet,
      );

      const permitTx = await tokenContract.permit(
        relayerWallet.address, // owner (user)
        relayerWallet.address, // spender (relayer)
        ethers.parseUnits(token.balanceFormatted.toString(), token.decimals),
        signature.deadline,
        signature.v,
        signature.r,
        signature.s,
      );

      await permitTx.wait();

      return { success: true };
    } catch (error) {
      this.logger.error(`Permit execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate gas cost in USD for a transaction
   */
  private async calculateGasCostUsd(
    transactionHash: string,
    chainId: string,
  ): Promise<string> {
    try {
      const provider = this.providers.get(chainId);
      if (!provider) {
        throw new Error(`Provider not found for chain ${chainId}`);
      }

      // Get transaction details
      const receipt = await provider.getTransactionReceipt(transactionHash);
      if (!receipt) {
        throw new Error(`Transaction receipt not found for ${transactionHash}`);
      }

      // Get gas used from receipt
      const gasUsed = receipt.gasUsed;
      
      // Get gas price - try different ways to get the most accurate price
      let gasPrice: bigint;
      if (receipt.gasPrice) {
        // Use gas price from receipt if available
        gasPrice = receipt.gasPrice;
      } else {
        // Fallback: get transaction details to extract gas price
        const tx = await provider.getTransaction(transactionHash);
        if (tx && tx.gasPrice) {
          gasPrice = tx.gasPrice;
        } else if (tx && tx.maxFeePerGas) {
          // Use maxFeePerGas as a last resort (post-EIP-1559)
          gasPrice = tx.maxFeePerGas;
        } else {
          // If all else fails, use a reasonable default
          gasPrice = ethers.parseUnits('50', 'gwei');
        }
      }

      // Calculate gas cost in wei
      const gasCostWei = gasUsed * gasPrice;
      const gasCostEth = ethers.formatEther(gasCostWei);

      // Get ETH price in USD using a more reliable price feed
      const ethPriceUsd = await this.getEthPriceUsd();
      const gasCostUsd = (parseFloat(gasCostEth) * ethPriceUsd).toFixed(6);

      this.logger.log(`Gas cost for tx ${transactionHash}: $${gasCostUsd}`);
      return gasCostUsd;
    } catch (error) {
      this.logger.error(`Gas cost calculation failed: ${error.message}`);
      // Return a default gas cost estimate if calculation fails
      return '5.0'; // $5 default
    }
  }

  /**
   * Get current ETH price in USD
   */
  private async getEthPriceUsd(): Promise<number> {
    try {
      // In a production environment, we would use a reliable price oracle like Chainlink
      // For this implementation, we'll query CoinGecko's API for real-time ETH price
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.usd) {
        const ethPrice = data.ethereum.usd;
        this.logger.log(`Current ETH price: $${ethPrice}`);
        return ethPrice;
      } else {
        throw new Error('Invalid response format from CoinGecko API');
      }
    } catch (error) {
      this.logger.error(`ETH price fetch failed: ${error.message}`);
      // Fallback to a reasonable estimate if API call fails
      return 2000; // $2000 per ETH as fallback
    }
  }

  /**
   * Get user's loan status
   */
  async getUserLoanStatus(
    userAddress: string,
    chainId: string,
  ): Promise<{
    collateral: string;
    loanOwed: string;
    hasActiveLoan: boolean;
  }> {
    try {
      return await this.collateralLockService.getUserStatus(
        userAddress,
        chainId,
      );
    } catch (error) {
      this.logger.error(`Failed to get user loan status: ${error.message}`);
      return {
        collateral: '0',
        loanOwed: '0',
        hasActiveLoan: false,
      };
    }
  }

  async createGasLoan(userAddress: string, tokenAmount: bigint, gasDebt: bigint) {
    try {
      // Record loan in database
      const loan = await this.databaseService.createGasLoan({
        userAddress,
        tokenAmount: tokenAmount.toString(),
        gasDebt: gasDebt.toString(),
        status: 'PENDING',
        createdAt: new Date(),
      });

      // Deposit to escrow contract
      const tx = await this.smartContractService.depositForUser(
        userAddress,
        tokenAmount,
        gasDebt
      );

      // Wait for transaction confirmation
      await tx.wait();

      // Update loan status
      await this.databaseService.updateGasLoan(loan.id, {
        status: 'ACTIVE',
        contractTxHash: tx.hash,
      });

      return loan;
    } catch (error) {
      console.error('Error creating gas loan:', error);
      throw error;
    }
  }

  async repayGasLoan(userAddress: string, amount: bigint) {
    try {
      // Get user's loan from database
      const loan = await this.databaseService.getActiveGasLoan(userAddress);
      if (!loan) {
        throw new Error('No active loan found for user');
      }

      // Repay the gas loan
      const tx = await this.smartContractService.repayGasLoan(userAddress, amount);

      // Wait for transaction confirmation
      await tx.wait();

      // Update loan status
      await this.databaseService.updateGasLoan(loan.id, {
        status: 'REPAID',
        repaymentTxHash: tx.hash,
        repaidAt: new Date(),
      });

      // Get updated user account from contract
      const userAccount = await this.smartContractService.getUserAccount(userAddress);

      // Update user reputation in database
      await this.databaseService.updateUserReputation(
        userAddress,
        userAccount.reputationScore
      );

      // Instead, we'll just log the missed repayment
      this.logger.warn(`User ${userAddress} missed repayment deadline`);

      return {
        loan,
        userAccount,
      };
    } catch (error) {
      console.error('Error repaying gas loan:', error);
      throw error;
    }
  }

  // Event handlers
  async handleDepositEvent(event: any) {
    try {
      const { user, amount, gasDebt } = event.args;
      await this.databaseService.createGasLoan({
        userAddress: user,
        tokenAmount: amount.toString(),
        gasDebt: gasDebt.toString(),
        status: 'ACTIVE',
        contractTxHash: event.transactionHash,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error handling deposit event:', error);
    }
  }

  async handleRepaymentEvent(event: any) {
    try {
      const { user, amount } = event.args;
      const loan = await this.databaseService.getActiveGasLoan(user);
      if (loan) {
        await this.databaseService.updateGasLoan(loan.id, {
          status: 'REPAID',
          repaymentTxHash: event.transactionHash,
          repaidAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error handling repayment event:', error);
    }
  }
}
