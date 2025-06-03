import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TokenScannerController } from './token-scanner.controller';
import { TokenScannerService } from './token-scanner.service';
import { GasLoanService } from './gas-loan.service';
import { RubicSwapService } from './rubic-swap.service';
import { SwapTransactionService } from './swap-transaction.service';
import { CollateralLockService } from './collateral-lock.service';
import { SuiStakingService } from './sui-staking.service';
import { RewardManagementService } from './reward-management.service';
import { SuiBridgeService } from './sui-bridge.service';
import { RubicSwapController } from './rubic-swap.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
  ],
  controllers: [TokenScannerController, RubicSwapController],
  providers: [
    TokenScannerService,
    GasLoanService,
    RubicSwapService,
    SwapTransactionService,
    CollateralLockService,
    SuiStakingService,
    RewardManagementService,
    SuiBridgeService,
  ],
  exports: [
    TokenScannerService,
    GasLoanService,
    RubicSwapService,
    SwapTransactionService,
    CollateralLockService,
    SuiStakingService,
    RewardManagementService,
    SuiBridgeService,
  ],
})
export class TokenScannerModule {}
