import { Token } from './api/types';

interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates if the amount entered is valid for a token
 * @param amount Amount to validate
 * @param token Token to validate against
 * @returns Validation result with validity status and optional error message
 */
export const handleValidateAmount = async (
  amount: number,
  token: Token
): Promise<ValidationResult> => {
  // Amount must be a positive number
  if (isNaN(amount) || amount <= 0) {
    return {
      valid: false,
      message: 'Amount must be a positive number',
    };
  }

  // Amount must not exceed the user's balance
  const tokenBalance = parseFloat(token.balanceFormatted.toString());
  if (amount > tokenBalance) {
    return {
      valid: false,
      message: `Amount exceeds your balance of ${tokenBalance} ${token.symbol}`,
    };
  }

  // Minimum amount validation (0.0001 of the token)
  const minAmount = 0.0001;
  if (amount < minAmount) {
    return {
      valid: false,
      message: `Amount must be at least ${minAmount} ${token.symbol}`,
    };
  }

  // All validations passed
  return {
    valid: true,
  };
};
