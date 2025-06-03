
'use server';

import type { ValidationResult } from '@/lib/types';

export interface ValidateTokenAmountInput {
  tokenAmount: string;
  tokenSymbol: string;
}

export async function handleValidateAmount(data: ValidateTokenAmountInput): Promise<ValidationResult> {
  try {
    const { tokenAmount, tokenSymbol } = data;
    const amount = parseFloat(tokenAmount);
    
    // Basic validation checks
    if (isNaN(amount)) {
      return { isValid: false, reason: "Please enter a valid number." };
    }
    
    if (amount <= 0) {
      return { isValid: false, reason: "Amount must be greater than zero." };
    }
    
    // Check for reasonable transaction amount (example threshold)
    if (amount > 1000000) {
      return { 
        isValid: false, 
        reason: `The amount ${amount} ${tokenSymbol} seems unusually large for a transaction. Please verify.` 
      };
    }
    
    // Check decimal places (most tokens use up to 18 decimals, but we'll be more lenient)
    const decimalStr = tokenAmount.includes('.') ? tokenAmount.split('.')[1] : '';
    if (decimalStr.length > 18) {
      return { 
        isValid: false, 
        reason: `Too many decimal places. Most ${tokenSymbol} transactions use up to 18 decimal places.` 
      };
    }
    
    // All checks passed
    return { isValid: true };
  } catch (error) {
    console.error("Error validating token amount:", error);
    return { isValid: false, reason: "An unexpected error occurred during validation. Please try again." };
  }
}
