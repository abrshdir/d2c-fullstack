import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { AccountStatusDto } from './dto/account-status.dto'; // Import the new DTO
import {
  TokenScannerService,
  TokenWithValue,
  PermitData,
} from './token-scanner.service';
import { WalletQueryDto } from './dto/wallet-query.dto';
import { RubicSwapService } from './rubic-swap.service';
import { SwapTransactionService } from './swap-transaction.service';
import { GasLoanService } from './gas-loan.service';
import { ethers } from 'ethers';
import { PermitRequestDto } from './dto/permit-request.dto';
import { CollateralLockService } from './collateral-lock.service';
import { SuiStakingService, SuiStakingResult } from './sui-staking.service'; // Import SuiStakingService and Result
import { SuiStakingRequest } from './types/sui-staking.types'; // Import the DTO

// Local StakeRequestDto removed

interface SwapQuoteRequestDto {
  fromToken: string;
  toToken: string;
  amount: string;
  walletAddress: string;
  chainId: string;
}

interface SwapTransactionRequestDto {
  fromToken: string;
  toToken: string;
  amount: string;
  walletAddress: string;
  chainId: string;
  slippage: number;
}

@Controller('token-scanner')
export class TokenScannerController {
  constructor(
    private readonly tokenScannerService: TokenScannerService,
    private readonly rubicSwapService: RubicSwapService,
    private readonly swapTransactionService: SwapTransactionService,
    private readonly gasLoanService: GasLoanService,
    private readonly collateralLockService: CollateralLockService, // Remains for SUI logic, possibly for finalizeRewards
    private readonly suiStakingService: SuiStakingService, // Inject SuiStakingService
  ) {}

  @Get('scan')
  async scanWalletForTokens(
    @Query(new ValidationPipe({ transform: true })) queryDto: WalletQueryDto,
  ): Promise<{
    allTokens: TokenWithValue[];
    ethereumTokens: TokenWithValue[];
    sepoliaTokens: TokenWithValue[];
    hasStrandedValue: boolean;
    gasSponsoredSwapAvailable: boolean;
    outstandingDebt: number;
  }> {
    const scanResult = await this.tokenScannerService.scanWalletForTokens(
      queryDto.walletAddress,
    );

    // Get user account status from the CollateralLock contract
    let outstandingDebt = 0;
    try {
      // Fetching status from the new service via GasLoanService
      const accountStatus = await this.gasLoanService.getUserLoanStatus(
        queryDto.walletAddress,
        '1', // Ethereum mainnet - chainId might be less relevant here if D2C Escrow is on a specific chain
      );
      // Assuming getUserLoanStatus now returns { outstandingDebt: string, ... }
      outstandingDebt = Number(accountStatus.outstandingDebt);
    } catch (error) {
      console.error(`Error getting user account status: ${error.message}`, error.stack);
      // If there's an error, we'll default to 0 outstanding debt
    }

    return {
      allTokens: scanResult.allTokens,
      ethereumTokens: scanResult.ethereumTokens,
      sepoliaTokens: scanResult.sepoliaTokens,
      hasStrandedValue: scanResult.hasStrandedValue,
      gasSponsoredSwapAvailable:
        scanResult.hasStrandedValue && scanResult.allTokens.length > 0,
      outstandingDebt,
    };
  }

  @Get('scan-test')
  async scanWalletForTokensTest(
    @Query(new ValidationPipe({ transform: true })) queryDto: WalletQueryDto,
  ): Promise<{
    allTokens: TokenWithValue[];
    ethereumTokens: TokenWithValue[];
    sepoliaTokens: TokenWithValue[];
    hasStrandedValue: boolean;
    gasSponsoredSwapAvailable: boolean;
    outstandingDebt: number;
  }> {
    // In development, use Sepolia testnet
    const isDevelopment = process.env.NODE_ENV === 'development';
    const scanResult = await this.tokenScannerService.scanWalletForTokensTest(
      queryDto.walletAddress,
      isDevelopment,
    );

    return {
      allTokens: scanResult.allTokens,
      ethereumTokens: scanResult.ethereumTokens,
      sepoliaTokens: scanResult.sepoliaTokens,
      hasStrandedValue: scanResult.hasStrandedValue,
      gasSponsoredSwapAvailable: true, // Always true for testing
      outstandingDebt: 0, // No debt in test mode
    };
  }

  @Post('prepare-permit')
  async preparePermit(
    @Body(new ValidationPipe()) permitRequest: PermitRequestDto,
  ): Promise<{
    token: TokenWithValue;
    permitData?: PermitData;
    message?: string;
  }> {
    return this.tokenScannerService.getTokenDetailsAndPreparePermit(
      permitRequest.walletAddress,
      permitRequest.tokenAddress,
      permitRequest.chainId,
    );
  }

  @Post('stake-on-sui')
  async stakeOnSui(
    @Body(new ValidationPipe()) stakeRequest: SuiStakingRequest, // Use the imported DTO with ValidationPipe
  ): Promise<SuiStakingResult> { // Return type should be SuiStakingResult
    // The new flow is:
    // 1. User ensures their EVM loan (outstandingDebt in Dust2CashEscrow) is $0.
    //    This can be checked via the '/account-status' endpoint.
    // 2. User withdraws the desired USDC amount from Dust2CashEscrow to their own EVM wallet.
    //    This is a direct user interaction with the Dust2CashEscrow contract.
    // 3. User calls this '/stake-on-sui' endpoint, providing their userAddress,
    //    the chainId of their EVM wallet, and the usdcAmountToStake (which they have withdrawn).
    // The discountRate in stakeRequest might be ignored or used for other SUI-side logic if any,
    // but not for EVM loan discount as that loan should be zero.

    try {
      // The SuiStakingService.initiateSuiStaking will now handle:
      // - Verifying outstandingDebt is 0 using Dust2CashEscrowService.
      // - Taking usdcAmountToStake from stakeRequest.
      // - Performing the bridge and SUI-side staking operations.
      // - It no longer calls collateralLockService.applyStakingDiscount.
      return await this.suiStakingService.initiateSuiStaking(stakeRequest);
    } catch (error) {
      // Log the error or handle it as per application's error handling strategy
      // The service itself might throw HttpException or return a result with an error message.
      // Ensure this controller properly propagates or handles errors.
      this.tokenScannerService.logger.error(`Error in stakeOnSui controller: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred during SUI staking initiation.',
        // Initialize other fields of SuiStakingResult as undefined or default
        bridgeTransactionHash: undefined,
        suiStakingTransactionHash: undefined,
        stakedAmount: undefined,
        validatorAddress: undefined,
        estimatedRewards: undefined,
      };
    }
  }

  @Get('account-status')
  async getAccountStatus(
    @Query('walletAddress') walletAddress: string,
  ): Promise<AccountStatusDto> { // Use the new DTO
    const status = await this.gasLoanService.getUserLoanStatus(
      walletAddress,
      '1', // Ethereum mainnet - chainId might be less relevant here
    );
    // Adapt the 'status' object (which is now Dust2CashEscrow's status) to AccountStatusDto
    return {
      escrowedAmount: status.escrowedAmount,
      outstandingDebt: status.outstandingDebt,
      reputationScore: status.reputationScore,
      isBlacklisted: status.isBlacklisted,
      // For backward compatibility, if needed by frontend immediately:
      collateralAmount: status.escrowedAmount, // Map escrowedAmount to old field
      loanOwed: status.outstandingDebt,       // Map outstandingDebt to old field
    };
  }

// @Post('swap/quote')
// async getSwapQuote(
//   @Body(new ValidationPipe()) quoteRequest: SwapQuoteRequestDto,
  // ): Promise<{
  //   success: boolean;
  //   data?: {
  //     fromToken: {
  //       address: string;
  //       decimals: number;
  //       symbol: string;
  //     };
  //     toToken: {
  //       address: string;
  //       decimals: number;
  //       symbol: string;
  //     };
  //     toTokenAmount: string;
  //     fromTokenAmount: string;
  //     protocols: any[];
  //     estimatedGas: string;
  //   };
  //   error?: string;
  // }> {
  //   try {
  //     const quote = await this.rubicSwapService.getSwapQuoteNew(
  //       quoteRequest.fromToken,
  //       quoteRequest.toToken,
  //       quoteRequest.amount,
  //       quoteRequest.walletAddress,
  //       quoteRequest.chainId,
  //     );
  //     return { success: true, data: quote };
  //   } catch (error) {
  //     return { success: false, error: error.message };
  //   }
  // }

  // @Post('swap/transaction')
  // async getSwapTransaction(
  //   @Body(new ValidationPipe()) txRequest: SwapTransactionRequestDto,
  // ): Promise<{
  //   success: boolean;
  //   data?: {
  //     to: string;
  //     data: string;
  //     value: string;
  //     gasPrice: string;
  //     gasLimit: string;
  //   };
  //   error?: string;
  // }> {
  //   try {
  //     const tx = await this.rubicSwapService.getSwapTransaction(
  //       txRequest.fromToken,
  //       txRequest.toToken,
  //       txRequest.amount,
  //       txRequest.walletAddress,
  //       txRequest.chainId,
  //       txRequest.slippage,
  //     );
  //     return { success: true, data: tx };
  //   } catch (error) {
  //     return { success: false, error: error.message };
  //   }
  // }

  // @Post('swap/execute')
  // async executeSwap(
  //   @Body(new ValidationPipe()) txRequest: SwapTransactionRequestDto,
  // ): Promise<{
  //   success: boolean;
  //   transactionHash?: string;
  //   error?: string;
  // }> {
  //   try {
  //     const tx = await this.swapTransactionService.executeSwap(
  //       txRequest.fromToken,
  //       txRequest.toToken,
  //       txRequest.amount,
  //       txRequest.walletAddress,
  //       txRequest.chainId,
  //       txRequest.slippage,
  //     );
  //     return { success: true, transactionHash: tx.hash };
  //   } catch (error) {
  //     return { success: false, error: error.message };
  //   }
  // }
}
