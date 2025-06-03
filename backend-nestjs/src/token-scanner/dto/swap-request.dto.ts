import { IsEthereumAddress, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TokenWithValue } from '../token-scanner.service';

class TokenDto implements TokenWithValue {
  @IsNotEmpty()
  chainId: string;

  @IsNotEmpty()
  tokenAddress: string;

  @IsNotEmpty()
  symbol: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  decimals: number;

  @IsNotEmpty()
  balance: string;

  @IsNotEmpty()
  balanceFormatted: number;

  @IsNotEmpty()
  usdValue: number;
}

export class SwapRequestDto {
  @IsEthereumAddress()
  walletAddress: string;

  @ValidateNested()
  @Type(() => TokenDto)
  token: TokenWithValue;
}
