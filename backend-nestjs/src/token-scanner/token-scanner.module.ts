import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
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
import { SmartContractService } from './services/smart-contract.service';
import { DatabaseService } from './services/database.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { Loan, LoanSchema } from './schemas/loan.schema';
import { StakingPosition, StakingPositionSchema } from './schemas/staking-position.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Loan.name, schema: LoanSchema },
      { name: StakingPosition.name, schema: StakingPositionSchema },
    ]),
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
    SmartContractService,
    DatabaseService,
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
    SmartContractService,
    DatabaseService,
  ],
})
export class TokenScannerModule {}
