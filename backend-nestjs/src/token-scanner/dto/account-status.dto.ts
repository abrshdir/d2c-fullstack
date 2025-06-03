import { ApiProperty } from '@nestjs/swagger';

export class AccountStatusDto {
  @ApiProperty({ description: 'Amount of USDC held in escrow for the user.' })
  escrowedAmount: string;

  @ApiProperty({ description: 'Amount of gas loan to be repaid by the user.' })
  outstandingDebt: string;

  @ApiProperty({ description: 'User reputation score (0-100).' })
  reputationScore: number;

  @ApiProperty({ description: 'Whether the user is currently blacklisted.' })
  isBlacklisted: boolean;

  // Optional: For backward compatibility or if frontend still uses these terms
  @ApiProperty({ description: 'Legacy field: equivalent to escrowedAmount.', deprecated: true })
  collateralAmount?: string;

  @ApiProperty({ description: 'Legacy field: equivalent to outstandingDebt.', deprecated: true })
  loanOwed?: string;
}
