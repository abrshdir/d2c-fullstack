import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class PermitRequestDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  tokenAddress: string;

  @IsString()
  @IsNotEmpty()
  chainId: string;

  @IsNumber()
  @IsOptional()
  amount?: number;
}
