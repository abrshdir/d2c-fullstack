import { PermitData } from "./types";
import { parseUnits } from "ethers/lib/utils";
import * as ethers from "ethers";

const API_BASE_URL = "http://localhost:3001";

export class PermitService {
  // Method to calculate token amount with decimals (e.g., 1.0 ETH = 1 * 10^18 wei)
  static calculateTokenAmount(amount: number, decimals: number): string {
    return ethers.utils.parseUnits(amount.toString(), decimals).toString();
  }

  // Mock implementation that returns simulated permit data instead of making an API call
  static async preparePermit(params: {
    walletAddress: string;
    tokenAddress: string;
    chainId: string;
  }): Promise<PermitData> {
    try {
      console.log('Preparing permit with params:', params);
      
      const response = await fetch(`${API_BASE_URL}/token-scanner/prepare-permit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: params.walletAddress,
          tokenAddress: params.tokenAddress,
          chainId: params.chainId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      
      if (!data) {
        throw new Error('No data received from API');
      }

      // Use the Protoclink swap contract address as the spender
      const spenderAddress = '0xDec80E988F4baF43be69c13711453013c212feA8';

      // Create permit data
      const permitData: PermitData = {
        owner: params.walletAddress,
        spender: spenderAddress,
        value: data.value || '0',
        nonce: data.nonce || 0,
        deadline: data.deadline || Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        chainId: parseInt(params.chainId), // Convert string to number
        name: data.name || 'Token',
        symbol: data.symbol || 'TKN',
        tokenAddress: params.tokenAddress,
      };

      return permitData;
    } catch (error) {
      console.error('Error preparing permit:', error);
      throw error;
    }
  }

  static async signPermit(
    permitData: PermitData,
    signer: any
  ): Promise<{ v: number; r: string; s: string } | null> {
    try {
      if (!permitData || !signer) {
        throw new Error('Missing permit data or signer');
      }

      // Extract the actual permit data from the nested structure
      const actualPermitData = permitData.permitData || permitData;

      // Ensure value is a valid BigNumber
      if (!actualPermitData.value) {
        throw new Error('Permit value is required');
      }

      const value = ethers.BigNumber.from(actualPermitData.value);

      const domain = {
        name: actualPermitData.name || 'Token',
        version: '1',
        chainId: actualPermitData.chainId,
        verifyingContract: actualPermitData.tokenAddress,
      };

      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };

      // Log the values for debugging
      console.log('Permit Data:', actualPermitData);
      console.log('Domain:', domain);
      console.log('Types:', types);

      const values = {
        owner: actualPermitData.owner,
        spender: actualPermitData.spender,
        value: value,
        nonce: actualPermitData.nonce,
        deadline: actualPermitData.deadline,
      };

      // Log the values for debugging
      console.log('Values:', values);

      // Validate all required fields
      if (!values.owner || !values.spender || values.nonce === undefined || !values.deadline) {
        console.error('Missing required permit fields:', {
          owner: values.owner,
          spender: values.spender,
          nonce: values.nonce,
          deadline: values.deadline
        });
        throw new Error('Missing required permit data fields');
      }

      const signature = await signer._signTypedData(domain, types, values);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      return { v, r, s };
    } catch (error: any) {
      console.error('Error signing permit:', error);
      throw new Error(`Failed to sign permit: ${error.message}`);
    }
  }
}
