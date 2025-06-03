import { IsNotEmpty, IsString } from 'class-validator';

export class RepaymentRequestDto {
  @IsNotEmpty()
  @IsString()
  walletAddress: string;

  @IsNotEmpty()
  @IsString()
  bridgedAmount: string;
}
