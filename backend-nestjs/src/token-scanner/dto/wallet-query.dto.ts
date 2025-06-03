import { IsEthereumAddress } from 'class-validator';

export class WalletQueryDto {
  @IsEthereumAddress()
  walletAddress: string;
}
