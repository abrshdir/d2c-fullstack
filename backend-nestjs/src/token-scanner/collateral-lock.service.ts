import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

const COLLATERAL_LOCK_CONTRACT_ADDRESS =
  '0xDCc2662a9301eCD933dE3274407C7CEFd562fA09';

// Define the contract interface-
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
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>('ETHEREUM_RPC_URL') || 'YOUR_RPC_URL',
    );

    this.relayerPrivateKey =
      this.configService.get<string>('RELAYER_PRIVATE_KEY') || '';

    this.collateralLockContract = new ethers.Contract(
      this.contractAddress,
      this.contractABI,
      this.provider,
    );
  }

  async lockCollateral(
    userAddress: string,
    usdcAmount: string | ethers.BigNumberish,
    gasCost: string | ethers.BigNumberish,
  ): Promise<ethers.ContractTransactionResponse> {
    const wallet = new ethers.Wallet(this.relayerPrivateKey, this.provider);
    const contractWithSigner = this.collateralLockContract.connect(wallet);
    return (contractWithSigner as any).lockCollateral(userAddress, usdcAmount, gasCost);
  }

  async withdraw(): Promise<ethers.ContractTransactionResponse> {
    const wallet = new ethers.Wallet(this.relayerPrivateKey, this.provider);
    const contractWithSigner = this.collateralLockContract.connect(wallet);
    return (contractWithSigner as any).withdraw();
  }

  async stakeOnSui(
    discountRate: number,
  ): Promise<ethers.ContractTransactionResponse> {
    const wallet = new ethers.Wallet(this.relayerPrivateKey, this.provider);
    const contractWithSigner = this.collateralLockContract.connect(wallet);
    return (contractWithSigner as any).stakeOnSui(discountRate);
  }

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
  async lockCollateralWithWallet(
    userAddress: string,
    usdcAmount: string,
    loanAmount: string,
    relayerWallet: ethers.Wallet,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const contract = new ethers.Contract(
        COLLATERAL_LOCK_CONTRACT_ADDRESS,
        COLLATERAL_LOCK_ABI,
        relayerWallet,
      );

      const usdcAmountWei = ethers.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      const loanAmountWei = ethers.parseUnits(loanAmount, 6);

      const tx = await contract.lockCollateral(
        userAddress,
        usdcAmountWei,
        loanAmountWei,
      );

      const receipt = await tx.wait();

      this.logger.log(
        `Collateral locked for user ${userAddress}: ${usdcAmount} USDC`,
      );

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to lock collateral: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's collateral and loan status
   */
  async getUserStatus(
    userAddress: string,
    chainId: string,
  ): Promise<{ collateral: string; loanOwed: string; hasActiveLoan: boolean }> {
    try {
      const provider = this.getProviderForChain(chainId);
      const contract = new ethers.Contract(
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

      return {
        collateral: collateralFormatted,
        loanOwed: loanOwedFormatted,
        hasActiveLoan:
          parseFloat(collateralFormatted) > 0 &&
          parseFloat(loanOwedFormatted) > 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get user status: ${error.message}`);
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
  async applyStakingDiscount(
    userAddress: string,
    discountRate: number,
    chainId: string,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      const provider = this.getProviderForChain(chainId);
      const relayerWallet = new ethers.Wallet(this.relayerPrivateKey, provider);

      const contract = new ethers.Contract(
        COLLATERAL_LOCK_CONTRACT_ADDRESS,
        COLLATERAL_LOCK_ABI,
        relayerWallet,
      );

      // This should be called by the user, not the relayer
      // But for automation, we can simulate it
      const tx = await contract.stakeOnSui(discountRate);
      const receipt = await tx.wait();

      this.logger.log(
        `Applied ${discountRate}% discount for user ${userAddress}`,
      );

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      this.logger.error(`Failed to apply staking discount: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
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
   * Handle CollateralLocked event
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
