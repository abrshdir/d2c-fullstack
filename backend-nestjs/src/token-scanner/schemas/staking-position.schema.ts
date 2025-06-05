import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum StakingStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  UNSTAKING = 'UNSTAKING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class StakingPosition extends Document {
  @Prop({ required: true })
  loanId: string;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ required: true })
  validatorAddress: string;

  @Prop({ required: true, type: String })
  stakedAmount: string;

  @Prop({ type: String, default: '0' })
  accruedRewards: string;

  @Prop({ required: true })
  stakingPeriodDays: number;

  @Prop({ required: true })
  stakingStartTime: Date;

  @Prop({ required: true })
  stakingEndTime: Date;

  @Prop({ enum: StakingStatus, default: StakingStatus.PENDING })
  status: StakingStatus;

  @Prop()
  transactionHash: string;

  @Prop({ type: Object })
  details: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Loan' })
  loan: MongooseSchema.Types.ObjectId;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'Transaction' }])
  transactions: MongooseSchema.Types.ObjectId[];
}

export const StakingPositionSchema = SchemaFactory.createForClass(StakingPosition); 