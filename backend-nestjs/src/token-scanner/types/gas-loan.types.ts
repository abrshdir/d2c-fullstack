import { TokenWithValue } from './token.types';

export interface PermitData {
  deadline: number;
  v: number;
  r: string;
  s: string;
}

export interface PermitSignature {
  v: number;
  r: string;
  s: string;
  deadline: number;
  nonce: number;
}

export interface GasLoanRequest {
  userAddress: string;
  token: TokenWithValue;
  permitData: PermitData;
  permitSignature: PermitSignature;
  chainId: string;
} 