import { IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { TokenWithValue } from '../token-scanner.service';

/**
 * DTO class for TokenWithValue to be used with class-validator and class-transformer
 */
export class TokenWithValueDto implements TokenWithValue {
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @IsString()
  @IsNotEmpty()
  tokenAddress: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  decimals: number;

  @IsString()
  @IsNotEmpty()
  balance: string;

  @IsNumber()
  balanceFormatted: number;

  @IsNumber()
  usdValue: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  value: number;
}
