import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  UNSTAKING = 'UNSTAKING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

@Schema({ timestamps: true })
export class Withdrawal extends Document {
  @Prop({ required: true })
  walletAddress: string;

  @Prop({ required: true })
  amount: string;

  @Prop({ required: true })
  tokenAddress: string;

  @Prop({ required: true })
  tokenSymbol: string;

  @Prop({ enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;

  @Prop()
  transactionHash?: string;

  @Prop()
  loanId?: string;

  @Prop()
  unstakingTransactionHash?: string;

  @Prop()
  finalizeTransactionHash?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal); 