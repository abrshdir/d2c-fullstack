import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  SuiBridgeService,
  BridgeQuote,
  BridgeResult,
  BridgeStatus,
} from './sui-bridge.service';
import { BridgeRequestDto } from './dto/bridge-request.dto';
import { SwapTransactionService } from './swap-transaction.service';
// SuiRepaymentService import removed

@Controller('token-scanner/bridge')
export class SuiBridgeController {
  constructor(
    private readonly suiBridgeService: SuiBridgeService,
    private readonly swapTransactionService: SwapTransactionService,
    // SuiRepaymentService injection removed
  ) {}

  @Post('quote')
  async getBridgeQuote(
    @Body(new ValidationPipe()) bridgeRequest: BridgeRequestDto,
  ): Promise<BridgeQuote> {
    return this.suiBridgeService.getBridgeQuote(bridgeRequest.token);
  }

  @Post('execute')
  async executeGasSponsoredBridge(
    @Body(new ValidationPipe()) bridgeRequest: BridgeRequestDto,
  ): Promise<BridgeResult> {
    // If no destination address is provided, use the source wallet address
    const destAddress =
      bridgeRequest.destinationAddress || bridgeRequest.walletAddress;

    return this.suiBridgeService.executeGasSponsoredBridge(
      bridgeRequest.token,
      bridgeRequest.walletAddress,
      destAddress,
    );
  }

  @Get('status/:transactionHash')
  async checkBridgeStatus(
    @Param('transactionHash') transactionHash: string,
  ): Promise<{ status: BridgeStatus; transactionHash: string }> {
    const status =
      await this.suiBridgeService.checkBridgeStatus(transactionHash);
    return { status, transactionHash };
  }

  @Get('transactions/:walletAddress')
  async getBridgeTransactions(
    @Param('walletAddress') walletAddress: string,
  ): Promise<BridgeResult[]> {
    // In a real implementation, this would query your database for bridge transactions
    // For now, we'll return an empty array
    return [];
  }

  // Webhook endpoint for bridge providers to notify about status changes
  @Post('webhook')
  async bridgeWebhook(
    @Body()
    webhookData: {
      transactionHash: string;
      status: string;
      destinationTxHash?: string;
      walletAddress?: string;
      bridgedAmount?: string;
    },
  ): Promise<{ success: boolean }> {
    let bridgeStatus: BridgeStatus;

    switch (webhookData.status.toLowerCase()) {
      case 'completed':
        bridgeStatus = BridgeStatus.COMPLETED;
        break;
      case 'failed':
        bridgeStatus = BridgeStatus.FAILED;
        break;
      default:
        bridgeStatus = BridgeStatus.PENDING;
    }

    const result = await this.suiBridgeService.updateBridgeStatus(
      webhookData.transactionHash,
      bridgeStatus,
      webhookData.destinationTxHash,
    );

    // If the bridge is completed and we have wallet address and amount info,
    // process the repayment to deduct gas loan debt - This logic is now removed.
    // Repayment and loan tracking are handled by Dust2CashEscrowService and user interaction with the contract.
    if (
      bridgeStatus === BridgeStatus.COMPLETED &&
      webhookData.walletAddress &&
      webhookData.bridgedAmount
    ) {
      // await this.suiRepaymentService.processRepayment(
      //   webhookData.walletAddress,
      //   webhookData.bridgedAmount,
      // );
      this.suiBridgeService.logger.log(
        `Bridge completed for user ${webhookData.walletAddress}, amount ${webhookData.bridgedAmount}. ` +
        `Repayment logic previously here is now handled by Dust2CashEscrow contract interactions.`
      );
    }

    return { success: result };
  }
}
