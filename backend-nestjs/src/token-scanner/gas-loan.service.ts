import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { TokenWithValue } from './token-scanner.service';
import { RubicSwapService } from './rubic-swap.service'; // Removed SwapResult as it's not directly used here anymore for usdcObtained
import { Dust2CashEscrowService } from './services/dust2cash-escrow.service'; // Import new escrow service

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
    private readonly dust2CashEscrowService: Dust2CashEscrowService, // Inject new escrow service
  ) {
    this.relayerPrivateKey = this.configService.get<string>(
      'RELAYER_PRIVATE_KEY', // This should be the Owner key for Dust2CashEscrow
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
      this.logger.log(
        `Processing gas loan for user: ${request.userAddress}, ` +
        `Token: ${request.token.symbol}, Address: ${request.token.tokenAddress}, ChainID: ${request.token.chainId}, ` +
        `Input USD Value: $${request.token.usdValue.toFixed(2)}`
      );

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

      // Step 4: Deposit swapped USDC into Dust2CashEscrow and record gas debt
      // The `depositForUser` function in Dust2CashEscrow.sol expects USDC amount and gasDebt amount
      // The actual USDC amount from the swap is `swapResult.usdcObtained`
      // The gas debt is `gasCostUsd`
      // Ensure amounts are in correct units (e.g., wei or smallest unit for USDC)

      // Important: The relayerWallet (owner of Dust2CashEscrow) must have the swapped USDC to deposit.
      // This implies RubicSwapService should send the swapped USDC to the relayerWallet's address,
      // not the user's address directly after the swap.
      // For now, we assume swapResult.usdcObtained is the amount received by the relayer.
      // And relayerWallet is the signer for depositForUser.

      // Also, ensure the Dust2CashEscrow contract is approved to spend relayer's USDC.
      // This approval should be done once by the relayer (owner).
      // This service does not handle that approval; it's a setup step.

      if (!swapResult.usdcObtained) {
        this.logger.error('USDC obtained from swap is undefined or zero.');
        return {
          success: false,
          error: 'Swap did not return the amount of USDC obtained.',
        };
      }

      try {
        const depositTx = await this.dust2CashEscrowService.depositForUser(
          request.userAddress, // The user for whom the deposit is made
          swapResult.usdcObtained, // Amount of USDC from the swap
          gasCostUsd, // Gas cost recorded as debt
        );
        await depositTx.wait(); // Wait for the transaction to be mined
        this.logger.log(
          `Collateral deposited to Dust2CashEscrow for user: ${request.userAddress}, tx: ${depositTx.hash}`,
        );
      } catch (depositError) {
        this.logger.error(
          `Failed to deposit collateral to Dust2CashEscrow: ${depositError.message}`,
          depositError.stack,
        );
        return {
          success: false,
          error: `Collateral deposit failed: ${depositError.message}`,
        };
      }

      this.logger.log(
        `Gas loan processed successfully for user: ${request.userAddress}`,
      );

      return {
        success: true,
        transactionHash: swapResult.transactionHash,
        usdcObtained: swapResult.usdcObtained, // Still useful to return
        gasCostUsd: gasCostUsd, // Gas cost of the swap
        loanAmount: gasCostUsd, // The amount of the loan is the gas cost
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
    escrowedAmount: string;
    outstandingDebt: string;
    reputationScore: number;
    isBlacklisted: boolean;
    // Add hasActiveLoan for compatibility if needed, or adjust frontend
  }> {
    try {
      const accountStatus = await this.dust2CashEscrowService.getUserAccountStatus(userAddress);
      // Adapt the response to match the old structure or update the calling code.
      // For now, returning the new structure.
      // To match old structure:
      // return {
      //   collateral: accountStatus.escrowedAmount,
      //   loanOwed: accountStatus.outstandingDebt,
      //   hasActiveLoan: parseFloat(accountStatus.outstandingDebt) > 0,
      // };
      return {
        ...accountStatus,
        // chainId is not part of Dust2CashEscrowService.getUserAccountStatus,
        // if it's critical, it needs to be passed through or handled differently.
      };
    } catch (error) {
      this.logger.error(`Failed to get user loan status from Dust2CashEscrowService: ${error.message}`, error.stack);
      // Return a default/error structure that matches what the frontend expects
      // or rethrow and handle in controller
      return {
        escrowedAmount: '0',
        outstandingDebt: '0',
        reputationScore: 0,
        isBlacklisted: false,
        // hasActiveLoan: false, // if trying to match old structure
      };
    }
  }
}
