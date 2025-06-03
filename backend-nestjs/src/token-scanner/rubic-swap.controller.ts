import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { RubicSwapService, SwapResult, SwapQuote } from './rubic-swap.service';
import { SwapRequestDto } from './dto/swap-request.dto';
import {
  SwapTransactionService,
  SwapTransaction,
} from './swap-transaction.service';

@Controller('token-scanner/swap')
export class RubicSwapController {
  constructor(
    private readonly rubicSwapService: RubicSwapService,
    private readonly swapTransactionService: SwapTransactionService,
  ) {}

  @Post('execute')
  async executeGasSponsoredSwap(
    @Body(new ValidationPipe()) swapRequest: SwapRequestDto,
  ): Promise<SwapTransaction> {
    const swapResult = await this.rubicSwapService.executeGasSponsoredSwap(
      swapRequest.token,
      swapRequest.walletAddress,
    );

    // Record the transaction in our tracking service
    return this.swapTransactionService.recordTransaction(
      swapRequest.walletAddress,
      swapRequest.token.symbol,
      swapRequest.token.tokenAddress,
      swapRequest.token.chainId,
      swapResult,
    );
  }

  @Get('transactions/:walletAddress')
  async getWalletTransactions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<SwapTransaction[]> {
    return this.swapTransactionService.getTransactionsForWallet(walletAddress);
  }

  @Get('debt/:walletAddress')
  async getWalletDebt(
    @Param('walletAddress') walletAddress: string,
  ): Promise<{ outstandingDebt: number }> {
    const debt =
      this.swapTransactionService.getTotalOutstandingDebt(walletAddress);
    return { outstandingDebt: debt };
  }

  @Post('mark-paid/:transactionId')
  async markTransactionAsPaid(
    @Param('transactionId') transactionId: string,
  ): Promise<{ success: boolean }> {
    const result =
      this.swapTransactionService.markTransactionAsPaid(transactionId);
    return { success: result };
  }

  @Post('quote')
  async getSwapQuote(
    @Body(new ValidationPipe()) swapRequest: SwapRequestDto,
  ): Promise<SwapQuote> {
    return this.rubicSwapService.getSwapQuote(
      swapRequest.token.tokenAddress,
      this.rubicSwapService['USDC_ETH'], // Using the USDC_ETH address from the service
      swapRequest.token.balanceFormatted.toString(),
      swapRequest.walletAddress,
      swapRequest.token.chainId,
    );
  }

  @Post('transactions/track')
  async trackTransaction(
    @Body()
    trackingData: {
      transactionHash: string;
      status: string;
      walletAddress: string;
    },
  ): Promise<{ success: boolean }> {
    // Record or update the transaction in our tracking service
    const result = await this.swapTransactionService.trackTransaction(
      trackingData.walletAddress,
      trackingData.transactionHash,
      trackingData.status,
    );
    return { success: result };
  }

  @Get('transactions/status/:txHash')
  async getTransactionStatus(
    @Param('txHash') txHash: string,
  ): Promise<{ status: string }> {
    const status =
      await this.swapTransactionService.getTransactionStatus(txHash);
    return { status };
  }

  @Get('widget-config')
  getWidgetConfig(): { apiKey: string; headlessMode: boolean } {
    // Return configuration for the Rubic widget
    return {
      apiKey: process.env.RUBIC_API_KEY || '',
      headlessMode: true,
    };
  }
}
