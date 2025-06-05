import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  STAKING = 'STAKING',
  WITHDRAWING = 'WITHDRAWING',
  CLOSED = 'CLOSED',
  COMPLETED = 'COMPLETED',
}

@Schema({ timestamps: true })
export class Loan extends Document {
  @Prop({ required: true })
  walletAddress: string;

  @Prop({ required: true, type: String })
  collateralAmount: string;

  @Prop({ required: true })
  collateralTokenAddress: string;

  @Prop({ required: true })
  collateralTokenSymbol: string;

  @Prop({ required: true, type: String })
  loanAmount: string;

  @Prop({ required: true })
  loanTokenAddress: string;

  @Prop({ required: true })
  loanTokenSymbol: string;

  @Prop({ enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Prop()
  swapTransactionHash: string;

  @Prop({ type: String })
  swappedAmount: string;

  @Prop()
  swappedTokenAddress: string;

  @Prop()
  swappedTokenSymbol: string;

  @Prop({ type: Object })
  details: Record<string, any>;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'Transaction' }])
  transactions: MongooseSchema.Types.ObjectId[];

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'StakingPosition' }])
  stakingPositions: MongooseSchema.Types.ObjectId[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const LoanSchema = SchemaFactory.createForClass(Loan); 