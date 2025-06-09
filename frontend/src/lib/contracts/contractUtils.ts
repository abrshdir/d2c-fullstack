import { ethers } from 'ethers';
import type { Provider } from 'ethers';
import Dust2CashEscrowABI from './Dust2CashEscrowABI';

// Contract address from integration guide
const CONTRACT_ADDRESS = '0x7fffBC1fc84F816353684EAc12E9a3344FFEAD29';

// Create contract instance
export const getContractInstance = async (provider: Provider) => {
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, Dust2CashEscrowABI, signer);
};

// Get contract read-only instance (no signer)
export const getReadOnlyContractInstance = (provider: Provider) => {
  return new ethers.Contract(CONTRACT_ADDRESS, Dust2CashEscrowABI, provider);
};

// Estimate gas for contract function call
export const estimateGasForDepositForUser = async (
  contract: ethers.Contract,
  userAddress: string,
  amount: string,
  gasDebt: string
) => {
  try {
    const gasEstimate = await contract.estimateGas.depositForUser(userAddress, amount, gasDebt);
    return gasEstimate;
  } catch (error) {
    console.error('Error estimating gas:', error);
    throw error;
  }
};

