import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
} from '@nestjs/common';
import { SuiRepaymentService, RepaymentResult } from './sui-repayment.service';
import { RepaymentRequestDto } from './dto/repayment-request.dto';

@Controller('token-scanner/repayment')
export class SuiRepaymentController {
  constructor(private readonly repaymentService: SuiRepaymentService) {}

  @Post('process')
  async processRepayment(
    @Body(new ValidationPipe()) repaymentRequest: RepaymentRequestDto,
  ): Promise<RepaymentResult> {
    return this.repaymentService.processRepayment(
      repaymentRequest.walletAddress,
      repaymentRequest.bridgedAmount,
    );
  }

  @Get(':walletAddress')
  async getWalletRepayments(
    @Param('walletAddress') walletAddress: string,
  ): Promise<RepaymentResult[]> {
    return this.repaymentService.getRepaymentsForWallet(walletAddress);
  }

  @Get('unlocked-balance/:walletAddress')
  async getUnlockedBalance(
    @Param('walletAddress') walletAddress: string,
  ): Promise<{ walletAddress: string; unlockedBalance: string }> {
    // Get the most recent repayment for this wallet
    const repayments =
      this.repaymentService.getRepaymentsForWallet(walletAddress);

    if (repayments.length === 0) {
      return { walletAddress, unlockedBalance: '0' };
    }

    // Sort by timestamp descending to get the most recent
    const latestRepayment = repayments.sort(
      (a, b) => b.timestamp - a.timestamp,
    )[0];

    return {
      walletAddress,
      unlockedBalance: latestRepayment.remainingBalance,
    };
  }
}
