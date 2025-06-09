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
import { RubicSwapService } from './swap.service';
import { SwapTransactionService } from './swap-transaction.service';
import { GasLoanService } from './gas-loan.service';
import { ethers } from 'ethers';
import { PermitRequestDto } from './dto/permit-request.dto';
import { CollateralLockService } from './collateral-lock.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

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

@ApiTags('token-scanner')
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
    hasStrandedValue: boolean;
    gasSponsoredSwapAvailable: boolean;
    outstandingDebt: number;
  }> {
    // In development, use test mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    const scanResult = await this.tokenScannerService.scanWalletForTokensTest(
      queryDto.walletAddress,
      isDevelopment,
    );

    return {
      allTokens: scanResult.allTokens,
      ethereumTokens: scanResult.ethereumTokens,
      hasStrandedValue: scanResult.hasStrandedValue,
      gasSponsoredSwapAvailable: true, // Always true for testing
      outstandingDebt: 0, // No debt in test mode
    };
  }

  @Post('prepare-permit')
  @ApiOperation({ summary: 'Prepare permit data for token swap' })
  @ApiResponse({ status: 200, description: 'Permit data prepared successfully' })
  async preparePermit(
    @Body() body: { walletAddress: string; tokenAddress: string; chainId: string },
  ): Promise<{ token: TokenWithValue; permitData?: PermitData; message?: string }> {
    return this.tokenScannerService.getTokenDetailsAndPreparePermit(
      body.walletAddress,
      body.tokenAddress,
      body.chainId,
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

  @Post('estimate-gas')
  @ApiOperation({ summary: 'Estimate gas for token swap' })
  @ApiResponse({ status: 200, description: 'Gas estimate calculated successfully' })
  async estimateGas(
    @Body()
    body: {
      fromToken: any;
      toToken: any;
      amount: number;
      userAddress: string;
    },
  ): Promise<{
    gasEstimate: string;
    gasCostInEth: string;
    gasCostInUsd: string;
  }> {
    return this.tokenScannerService.estimateGasForSwap(
      body.fromToken,
      body.toToken,
      body.amount,
      body.userAddress,
    );
  }

  @Post('execute-swap')
  @ApiOperation({ summary: 'Execute token swap using permit' })
  @ApiResponse({ status: 200, description: 'Swap executed successfully' })
  async executeSwap(
    @Body()
    body: {
      permitData: PermitData;
      signature: { v: number; r: string; s: string };
      amount: number;
      fromToken: any;
      toToken: any;
    },
  ): Promise<{ status: string; txHash?: string; error?: string }> {
    try {
      const result = await this.tokenScannerService.executeSwapWithPermit(
        body.permitData,
        body.signature,
        body.amount,
        body.fromToken,
        body.toToken,
      );
      return { status: 'success', txHash: result.txHash };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}
