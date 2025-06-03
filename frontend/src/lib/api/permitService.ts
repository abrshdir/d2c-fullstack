import { PermitData } from "./types";
import { ethers } from "ethers";

const API_BASE_URL = "http://localhost:3001";

export class PermitService {
  // Method to calculate token amount with decimals (e.g., 1.0 ETH = 1 * 10^18 wei)
  static calculateTokenAmount(amount: number, decimals: number): string {
    try {
      // Convert to BigInt to handle large numbers properly
      const amountInSmallestUnit = ethers.parseUnits(
        amount.toString(), 
        decimals
      );
      return amountInSmallestUnit.toString();
    } catch (error) {
      console.error("Error calculating token amount:", error);
      // Fallback implementation if ethers fails
      return (amount * Math.pow(10, decimals)).toString();
    }
  }

  // Mock implementation that returns simulated permit data instead of making an API call
  static async preparePermit(params: {
    walletAddress: string;
    tokenAddress: string;
    chainId: string;
  }): Promise<PermitData> {
    try {
      // Simulate network delay for realistic behavior
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create mock permit data
      const mockNonce = Math.floor(Math.random() * 1000); // Random nonce for simulation
      const mockDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      
      // Return mock permit data
      return {
        owner: params.walletAddress,
        spender: "0x7fffBC1fc84F816353684EAc12E9a3344FFEAD29", // Our contract address
        value: "0", // Will be updated with the actual amount when signing
        nonce: mockNonce,
        deadline: mockDeadline,
        chainId: Number(params.chainId),
        tokenAddress: params.tokenAddress,
      };
    } catch (error) {
      console.error("Error in preparePermit:", error);
      throw new Error(
        `Failed to prepare permit: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  static async signPermit(
    permitData: PermitData,
    signer: any
  ): Promise<{
    v: number;
    r: string;
    s: string;
  }> {
    try {
      // EIP-2612 domain
      const domain = {
        name: permitData.name || "Token",
        version: "1",
        chainId: permitData.chainId,
        verifyingContract: permitData.tokenAddress || permitData.spender,
      };

      // The types for EIP-2612 Permit
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      // The data to sign
      const value = {
        owner: permitData.owner,
        spender: permitData.spender,
        value: permitData.value,
        nonce: permitData.nonce,
        deadline: permitData.deadline,
      };

      // Sign the data
      const signature = await signer.signTypedData(domain, types, value);

      // Split the signature
      const r = signature.slice(0, 66);
      const s = "0x" + signature.slice(66, 130);
      const v = parseInt(signature.slice(130, 132), 16);

      return { v, r, s };
    } catch (error) {
      console.error("Error signing permit:", error);
      throw new Error(
        `Failed to sign permit: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
