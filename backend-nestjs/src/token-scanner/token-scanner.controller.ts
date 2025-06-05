import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ValidationPipe,
} from '@nestjs/common';
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

interface StakeRequestDto {
  walletAddress: string;
  discountRate: number;
}

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
    private readonly collateralLockService: CollateralLockService,
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
      const accountStatus = await this.gasLoanService.getUserLoanStatus(
        queryDto.walletAddress,
        '1', // Ethereum mainnet
      );
      outstandingDebt = Number(accountStatus.loanOwed);
    } catch (error) {
      console.error(`Error getting user account status: ${error.message}`);
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
    @Body() stakeRequest: StakeRequestDto,
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      // This is a simplified example. In a real implementation, you would:
      // 1. Verify the user has collateral locked
      // 2. Connect to the user's wallet (this would typically happen on the frontend)
      // 3. Call the stakeOnSui method

      // For demonstration purposes only - in a real app, you wouldn't handle private keys like this
      const dummyWallet = new ethers.Wallet(
        ethers.Wallet.createRandom().privateKey,
      );

      // This would be replaced with actual frontend integration where the user signs the transaction
      const tx = await this.collateralLockService.stakeOnSui(
        stakeRequest.discountRate,
      );

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('account-status')
  async getAccountStatus(
    @Query('walletAddress') walletAddress: string,
  ): Promise<{
    collateralAmount: string;
    loanOwed: string;
  }> {
    const status = await this.gasLoanService.getUserLoanStatus(
      walletAddress,
      '1', // Ethereum mainnet
    );
    return {
      collateralAmount: status.collateral,
      loanOwed: status.loanOwed,
    };
  }
  
}
