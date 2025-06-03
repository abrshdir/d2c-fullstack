import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TokenWithValueDto } from './token-with-value.dto';

export class BridgeRequestDto {
  @ValidateNested()
  @Type(() => TokenWithValueDto)
  @IsNotEmpty()
  token: TokenWithValueDto;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsOptional()
  destinationAddress?: string;
}
