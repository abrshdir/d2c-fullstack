import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { RubicSwapService } from './swap.service';
import { SwapRequestDto } from './dto/swap-request.dto';
import {
  SwapTransactionService,
  SwapTransaction,
} from './swap-transaction.service';
import { SwapQuote } from './types/rubic-types';
import { SmartContractService } from './services/smart-contract.service';
import { Logger } from '@nestjs/common';
import { TokenWithValue } from './token-scanner.service';

@Controller('token-scanner/swap')
export class RubicSwapController {
  private readonly logger = new Logger(RubicSwapController.name);

  constructor(
    private readonly rubicSwapService: RubicSwapService,
    private readonly swapTransactionService: SwapTransactionService,
    private readonly smartContractService: SmartContractService,
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
    return this.rubicSwapService.getSwapQuoteProtocolink(
      swapRequest.token.tokenAddress,
      this.rubicSwapService['USDC_ETH'], // Using the USDC_ETH address from the service
      swapRequest.token.balanceFormatted.toString(),
      swapRequest.walletAddress,
      swapRequest.token.chainId,
    );
  }

  @Post('quote-testnet')
  async getSwapQuoteTestnet(
    @Body(new ValidationPipe()) swapRequest: SwapRequestDto,
  ): Promise<SwapQuote> {
    return this.rubicSwapService.getSwapQuoteUniswapV3Testnet(
      swapRequest.token.tokenAddress,
      this.rubicSwapService['USDC_ETH'],
      swapRequest.token.balanceFormatted.toString(),
      swapRequest.walletAddress,
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

  @Post('execute-swap')
  async executeSwap(
    @Body(new ValidationPipe()) swapRequest: {
      permitData: any;
      signature: { v: number; r: string; s: string };
      amount: number;
      fromToken: any;
      toToken: any;
    },
  ): Promise<{ status: string; error?: string }> {
    try {
      // Get swap quote from Protoclink
      const quote = await this.rubicSwapService.getSwapQuoteProtocolink(
        swapRequest.fromToken.tokenAddress,
        this.rubicSwapService['USDC_ETH'],
        swapRequest.amount.toString(),
        swapRequest.permitData.owner,
        swapRequest.fromToken.chainId,
      );

      // Execute swap through Protoclink's locked contract
      const tokenWithValue: TokenWithValue = {
        tokenAddress: swapRequest.fromToken.tokenAddress,
        name: swapRequest.fromToken.name,
        decimals: swapRequest.fromToken.decimals,
        balance: swapRequest.amount.toString(),
        balanceFormatted: Number(swapRequest.amount),
        usdValue: swapRequest.fromToken.usdValue || 0,
        value: Number(swapRequest.amount),
        chainId: swapRequest.fromToken.chainId,
        symbol: swapRequest.fromToken.symbol,
        address: swapRequest.fromToken.tokenAddress,
      };

      const swapResult = await this.rubicSwapService.executeGasSponsoredSwap(
        tokenWithValue,
        swapRequest.permitData.owner,
      );

      // Deposit USDC to escrow contract with gas debt
      await this.smartContractService.depositForUser(
        swapRequest.permitData.owner,
        BigInt(swapResult.usdcObtained),
        BigInt(swapResult.gasCost)
      );

      return {
        status: 'success',
      };
    } catch (error: any) {
      this.logger.error('Error executing swap:', error);
      return {
        status: 'error',
        error: error.message,
      };
    }
  }
}
