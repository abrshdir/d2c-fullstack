import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

const COLLATERAL_LOCK_CONTRACT_ADDRESS =
  '0xDCc2662a9301eCD933dE3274407C7CEFd562fA09';

// Define the contract interface
interface ICollateralLockContract extends ethers.BaseContract {
  lockCollateral(
    user: string,
    amount: ethers.BigNumberish,
    loanAmount: ethers.BigNumberish
  ): Promise<ethers.ContractTransactionResponse>;
  
  withdraw(): Promise<ethers.ContractTransactionResponse>;
  
  stakeOnSui(
    discountRate: number
  ): Promise<ethers.ContractTransactionResponse>;
  
  finalizeRewards(
    user: string,
    repayAmount: ethers.BigNumberish,
    payoutAmount: ethers.BigNumberish
  ): Promise<ethers.ContractTransactionResponse>;
}

const COLLATERAL_LOCK_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_usdc', type: 'address' },
      { internalType: 'address', name: '_relayer', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'loanAmount',
        type: 'uint256',
      },
    ],
    name: 'CollateralLocked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'repaid',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'payout',
        type: 'uint256',
      },
    ],
    name: 'Finalized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint8',
        name: 'discountRate',
        type: 'uint8',
      },
    ],
    name: 'StakeRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'payout',
        type: 'uint256',
      },
    ],
    name: 'Withdrawn',
    type: 'event',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'collateral',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'repayAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'payoutAmount', type: 'uint256' },
    ],
    name: 'finalizeRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'loanOwed',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'loanAmount', type: 'uint256' },
    ],
    name: 'lockCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'relayer',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint8', name: 'discountRate', type: 'uint8' }],
    name: 'stakeOnSui',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'usdc',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

@Injectable()
export class CollateralLockService {
  private readonly logger = new Logger(CollateralLockService.name);
  private provider: ethers.Provider;
  private collateralLockContract: ethers.Contract;
  private readonly contractAddress = COLLATERAL_LOCK_CONTRACT_ADDRESS;
  private readonly contractABI = COLLATERAL_LOCK_ABI;
  private relayerPrivateKey: string;

  constructor(private readonly configService: ConfigService) {
    // Note: Most EVM functionalities of this service are being deprecated in favor of Dust2CashEscrowService.
    // This service might be refactored to handle only SUI-related interactions or removed entirely
    // if Dust2CashEscrowService covers all necessary features across chains.

    const ethRpcUrl = this.configService.get<string>('ETHEREUM_RPC_URL');
    if (ethRpcUrl) {
        this.provider = new ethers.JsonRpcProvider(ethRpcUrl);
        this.relayerPrivateKey = this.configService.get<string>('RELAYER_PRIVATE_KEY') || '';
        if (this.relayerPrivateKey) {
            this.collateralLockContract = new ethers.Contract(
              this.contractAddress,
              this.contractABI,
              new ethers.Wallet(this.relayerPrivateKey, this.provider), // Initialize with signer for SUI ops
            );
        } else {
            this.logger.warn('Relayer private key not found, SUI operations will fail or be read-only.');
            this.collateralLockContract = new ethers.Contract(
              this.contractAddress,
              this.contractABI,
              this.provider, // Fallback to provider for read-only if no private key
            );
        }
    } else {
        this.logger.error('ETHEREUM_RPC_URL not configured. CollateralLockService may not function correctly.');
        // Consider how to handle this error, e.g. by throwing or using a mock provider.
        // For now, operations requiring this.provider will fail if ethRpcUrl is not set.
    }
  }

  /**
   * @deprecated EVM collateral locking is now handled by Dust2CashEscrowService.
   */
  async lockCollateral(
    userAddress: string,
    usdcAmount: string | ethers.BigNumberish,
    gasCost: string | ethers.BigNumberish,
  ): Promise<ethers.ContractTransactionResponse> {
    this.logger.warn('lockCollateral is deprecated for EVM; use Dust2CashEscrowService.depositForUser.');
    if (!this.collateralLockContract || !this.collateralLockContract.runner?.provider) {
        throw new Error('Provider not initialized for lockCollateral due to missing RPC URL or private key.');
    }
    throw new Error('lockCollateral is deprecated for EVM chains.');
  }

  /**
   * @deprecated EVM withdrawal is now handled by Dust2CashEscrowService. User calls withdrawFunds directly from the D2C Escrow.
   */
  async withdraw(): Promise<ethers.ContractTransactionResponse> {
    this.logger.warn('withdraw is deprecated for EVM; user should call withdrawFunds on Dust2CashEscrow contract.');
    if (!this.collateralLockContract || !this.collateralLockContract.runner?.provider) {
        throw new Error('Provider not initialized for withdraw due to missing RPC URL or private key.');
    }
    throw new Error('withdraw is deprecated for EVM chains.');
  }

  /**
   * @deprecated This method was tied to an EVM loan discount mechanism via CollateralLock.sol,
   * which is no longer part of the primary SUI staking flow as EVM loans (in Dust2CashEscrow)
   * must be paid off before SUI staking.
   */
  async stakeOnSui(
    discountRate: number,
  ): Promise<ethers.ContractTransactionResponse> {
    this.logger.warn(
      'CollateralLockService.stakeOnSui is deprecated for the new SUI staking flow. ' +
      'It was related to EVM loan discounts on CollateralLock.sol.'
    );
    if (!this.collateralLockContract || !this.collateralLockContract.runner?.provider) {
        throw new Error('Provider not initialized for stakeOnSui due to missing RPC URL or private key.');
    }
    throw new Error('stakeOnSui on CollateralLockService is deprecated in the current SUI staking flow.');
    // const wallet = new ethers.Wallet(this.relayerPrivateKey, this.provider);
    // const contractWithSigner = this.collateralLockContract.connect(wallet);
    // return (contractWithSigner as any).stakeOnSui(discountRate);
  }

  // This function might still be relevant if CollateralLock.sol is used for SUI reward finalization on EVM.
  // However, its usage needs to be re-evaluated in the context of the new staking flow.
  async finalizeRewards(
    userAddress: string,
    repayAmount: string | ethers.BigNumberish,
    payoutAmount: string | ethers.BigNumberish,
  ): Promise<ethers.ContractTransactionResponse> {
    const wallet = new ethers.Wallet(this.relayerPrivateKey, this.provider);
    const contractWithSigner = this.collateralLockContract.connect(wallet);
    return (contractWithSigner as any).finalizeRewards(userAddress, repayAmount, payoutAmount);
  }

  /**
   * Listen for CollateralLocked events
   */
  async startEventListener(): Promise<void> {
    if (!this.relayerPrivateKey) {
      this.logger.warn(
        'Cannot start event listener without relayer private key',
      );
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(
        this.configService.get<string>('ETHEREUM_RPC_URL'),
      );
      const contract = new ethers.Contract(
        COLLATERAL_LOCK_CONTRACT_ADDRESS,
        COLLATERAL_LOCK_ABI,
        provider,
      );

      // Listen for CollateralLocked events
      contract.on(
        'CollateralLocked',
        (user: string, amount: bigint, loanAmount: bigint, event: any) => {
          this.logger.log(
            `CollateralLocked event: user=${user}, amount=${amount}, loanAmount=${loanAmount}`,
          );
          // Handle the event (e.g., trigger backend processes)
          this.handleCollateralLocked(user, amount, loanAmount, event);
        },
      );

      // Listen for StakeRequested events
      contract.on(
        'StakeRequested',
        (user: string, amount: bigint, discountRate: number, event: any) => {
          this.logger.log(
            `StakeRequested event: user=${user}, amount=${amount}, discountRate=${discountRate}%`,
          );
          // Handle the staking request
          this.handleStakeRequested(user, amount, discountRate, event);
        },
      );

      // Listen for Withdrawn events
      contract.on('Withdrawn', (user: string, payout: bigint, event: any) => {
        this.logger.log(`Withdrawn event: user=${user}, payout=${payout}`);
        // Handle the withdrawal
        this.handleWithdrawn(user, payout, event);
      });

      // Listen for Finalized events
      contract.on(
        'Finalized',
        (user: string, repaid: bigint, payout: bigint, event: any) => {
          this.logger.log(
            `Finalized event: user=${user}, repaid=${repaid}, payout=${payout}`,
          );
          // Handle the finalization
          this.handleFinalized(user, repaid, payout, event);
        },
      );

      this.logger.log('Event listener started successfully');
    } catch (error) {
      this.logger.error(`Failed to start event listener: ${error.message}`);
    }
  }

  /**
   * Lock collateral for a user (called by relayer after swap) - Alternative implementation
   */
  /**
   * @deprecated EVM collateral locking is now handled by Dust2CashEscrowService.
   */
  async lockCollateralWithWallet(
    userAddress: string,
    usdcAmount: string,
    loanAmount: string,
    relayerWallet: ethers.Wallet, // This parameter makes it EVM specific in this context
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    this.logger.warn('lockCollateralWithWallet is deprecated for EVM; use Dust2CashEscrowService.depositForUser.');
    if (!this.collateralLockContract || !this.collateralLockContract.runner?.provider) {
        throw new Error('Provider not initialized for lockCollateralWithWallet due to missing RPC URL or private key.');
    }
    throw new Error('lockCollateralWithWallet is deprecated for EVM chains.');
  }

  /**
   * @deprecated EVM user status (collateral/loan) is now handled by Dust2CashEscrowService.getUserAccountStatus.
   * This method might still be used for SUI related loan status if CollateralLock.sol stores it.
   * For pure EVM loans, Dust2CashEscrowService is the source of truth.
   */
  async getUserStatus(
    userAddress: string,
    chainId: string, // chainId might indicate if it's an EVM or SUI context
  ): Promise<{ collateral: string; loanOwed: string; hasActiveLoan: boolean }> {
    this.logger.warn(
      `getUserStatus for EVM chains is deprecated. Use Dust2CashEscrowService.getUserAccountStatus. ` +
      `This method might be relevant for SUI loan portions if CollateralLock.sol is still used for that.`
    );

    // If it's an EVM chain that D2C Escrow handles, this data is stale/irrelevant for D2C loans.
    // For example, if chainId is for Ethereum, Base, etc., this data is not for D2C.
    if (!this.collateralLockContract || !this.collateralLockContract.runner?.provider) {
        throw new Error('Provider not initialized for getUserStatus due to missing RPC URL or private key.');
    }

    try {
      const provider = this.getProviderForChain(chainId); // This will use EVM provider based on chainId
      const contract = new ethers.Contract( // Querying the old CollateralLock contract
        COLLATERAL_LOCK_CONTRACT_ADDRESS,
        COLLATERAL_LOCK_ABI,
        provider,
      );

      const [collateral, loanOwed] = await Promise.all([
        contract.collateral(userAddress),
        contract.loanOwed(userAddress),
      ]);

      const collateralFormatted = ethers.formatUnits(collateral, 6);
      const loanOwedFormatted = ethers.formatUnits(loanOwed, 6);

      this.logger.log(`CollateralLock status for ${userAddress} on chain ${chainId}: Collateral=${collateralFormatted}, LoanOwed=${loanOwedFormatted}`);

      return {
        collateral: collateralFormatted,
        loanOwed: loanOwedFormatted,
        hasActiveLoan: parseFloat(loanOwedFormatted) > 0, // Active loan if loanOwed > 0
      };
    } catch (error) {
      this.logger.error(`Failed to get user status from CollateralLock for chain ${chainId}: ${error.message}`);
      return {
        collateral: '0',
        loanOwed: '0',
        hasActiveLoan: false,
      };
    }
  }

  /**
   * Apply staking discount to user's loan
   */
  /**
   * @deprecated This method was used to trigger stakeOnSui in CollateralLock.sol for an EVM loan discount.
   * With EVM loans in Dust2CashEscrow needing to be $0 before SUI staking, this specific utility is obsolete.
   */
  async applyStakingDiscount(
    userAddress: string,
    discountRate: number,
    chainId: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    this.logger.warn(
      'CollateralLockService.applyStakingDiscount is deprecated. ' +
      'EVM loan should be $0 before SUI staking, making this discount mechanism on CollateralLock.sol obsolete for this flow.'
    );
    throw new Error('applyStakingDiscount on CollateralLockService is deprecated.');
    // try {
    //   const provider = this.getProviderForChain(chainId);
    //   const relayerWallet = new ethers.Wallet(this.relayerPrivateKey, provider);

    //   const contract = new ethers.Contract(
    //     COLLATERAL_LOCK_CONTRACT_ADDRESS,
    //     COLLATERAL_LOCK_ABI,
    //     relayerWallet,
    //   );

    //   // This should be called by the user, not the relayer
    //   // But for automation, we can simulate it
    //   const tx = await contract.stakeOnSui(discountRate);
    //   const receipt = await tx.wait();

    //   this.logger.log(
    //     `Applied ${discountRate}% discount for user ${userAddress}`,
    //   );

    //   return {
    //     success: true,
    //     transactionHash: receipt.hash,
    //   };
    // } catch (error) {
    //   this.logger.error(`Failed to apply staking discount: ${error.message}`);
    //   return {
    //     success: false,
    //     error: error.message,
    //   };
    // }
  }

  /**
   * Get provider for a specific chain
   */
  private getProviderForChain(chainId: string): ethers.JsonRpcProvider {
    const rpcUrls: { [key: string]: string } = {
      '1': this.configService.get<string>('ETHEREUM_RPC_URL', ''),
      '11155111': this.configService.get<string>('SEPOLIA_RPC_URL', ''),
      '8453': this.configService.get<string>('BASE_RPC_URL', ''),
      '42161': this.configService.get<string>('ARBITRUM_RPC_URL', ''),
      '10': this.configService.get<string>('OPTIMISM_RPC_URL', ''),
    };

    const rpcUrl = rpcUrls[chainId];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for chain ${chainId}`);
    }

    return new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Handle CollateralLocked event - This event is from CollateralLock.sol,
   * related Deposited event is in Dust2CashEscrow.sol
   */
  private async handleCollateralLocked(
    user: string,
    amount: bigint,
    loanAmount: bigint,
    event: any,
  ): Promise<void> {
    this.logger.log(
      `Processing CollateralLocked event for user ${user}: amount=${amount}, loan=${loanAmount}`,
    );
    // TODO: Implement any additional processing needed when collateral is locked
    // For example, updating database records, sending notifications, etc.
  }

  /**
   * Handle StakeRequested event
   */
  private async handleStakeRequested(
    user: string,
    amount: bigint,
    discountRate: number,
    event: any,
  ): Promise<void> {
    this.logger.log(
      `Processing StakeRequested event for user ${user}: amount=${amount}, discount=${discountRate}%`,
    );
    // TODO: Trigger SUI staking process
    // This could involve calling the SuiStakingService to initiate the staking process
  }

  /**
   * Handle Withdrawn event
   */
  private async handleWithdrawn(
    user: string,
    payout: bigint,
    event: any,
  ): Promise<void> {
    this.logger.log(
      `Processing Withdrawn event for user ${user}: payout=${payout}`,
    );
    // TODO: Update user records, send notifications, etc.
  }

  /**
   * Handle Finalized event
   */
  private async handleFinalized(
    user: string,
    repaid: bigint,
    payout: bigint,
    event: any,
  ): Promise<void> {
    this.logger.log(
      `Processing Finalized event for user ${user}: repaid=${repaid}, payout=${payout}`,
    );
    // TODO: Clean up user records, send final notifications, etc.
  }
}
