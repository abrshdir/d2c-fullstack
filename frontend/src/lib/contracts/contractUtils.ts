import { ethers, BrowserProvider, JsonRpcProvider, Contract } from 'ethers';
import Dust2CashEscrowABI from './Dust2CashEscrowABI';

// Contract address from integration guide
const CONTRACT_ADDRESS = '0x7fffBC1fc84F816353684EAc12E9a3344FFEAD29';

// Create contract instance
export const getContractInstance = async (provider: BrowserProvider | JsonRpcProvider) => {
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, Dust2CashEscrowABI, signer);
};

// Get contract read-only instance (no signer)
export const getReadOnlyContractInstance = (provider: BrowserProvider | JsonRpcProvider) => {
  return new Contract(CONTRACT_ADDRESS, Dust2CashEscrowABI, provider);
};

// Estimate gas for contract function call
export const estimateGasForDepositForUser = async (
  contract: Contract,
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

// Get current gas price using Etherscan API
export const getCurrentGasPrice = async () => {
  try {
    // Fallback to provider gas price if Etherscan API is not available
    const provider = new JsonRpcProvider();
    return await provider.getFeeData().then(data => data.gasPrice || ethers.parseUnits('50', 'gwei'));
  } catch (error) {
    console.error('Error getting gas price:', error);
    // Return default gas price as fallback
    return ethers.parseUnits('50', 'gwei');
  }
};
