import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  SWAP = 'SWAP',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  CLAIM_REWARDS = 'CLAIM_REWARDS',
  BRIDGE = 'BRIDGE',
  TRANSFER = 'TRANSFER',
  INITIATE_WITHDRAWAL = 'INITIATE_WITHDRAWAL',
  FINALIZE_WITHDRAWAL = 'FINALIZE_WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop()
  loanId: string;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ required: true, type: String })
  amount: string;

  @Prop({ required: true })
  tokenAddress: string;

  @Prop()
  tokenSymbol: string;

  @Prop()
  transactionHash: string;

  @Prop({ enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop({ type: Object })
  details: Record<string, any>;

  @Prop()
  stakingPositionId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Loan' })
  loan: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'StakingPosition' })
  stakingPosition: MongooseSchema.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction); 