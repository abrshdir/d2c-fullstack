// frontend-new/src/lib/api/api.ts

import {
  GasLoanRequest,
  GasLoanResponse,
  StakingStatus,
  WithdrawRequest,
  WithdrawResponse,
  TransactionHistory,
  ApiError,
} from './types'; // Assuming types are generated or manually created based on openapi.yaml

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

// Authentication
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Retry logic
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry<T>(
  endpoint: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<T> {
  try {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    const authHeaders = getAuthHeaders();
    if (authHeaders.Authorization) {
      headers.append('Authorization', authHeaders.Authorization);
    }
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        headers.append(key, value as string);
      });
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      
      // Handle specific HTTP status codes
      switch (response.status) {
        case 400:
          throw new Error(`Bad request: ${error.message || 'Invalid request parameters'}`);
        case 401:
          throw new Error('Authentication required. Please log in again.');
        case 403:
          throw new Error('Access forbidden. You do not have permission to perform this action.');
        case 404:
          throw new Error(`Resource not found: ${endpoint}`);
        case 429:
          throw new Error('Too many requests. Please try again later.');
        case 500:
          throw new Error('Server error. Please try again later.');
        case 503:
          throw new Error('Service unavailable. Please try again later.');
        default:
          throw new Error(error.message || `Request failed with status ${response.status}`);
      }
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors
    if (error.message.includes('network') || error.message.includes('fetch')) {
      if (retries > 0) {
        console.warn(`Network error, retrying... (${retries} attempts remaining)`);
        await sleep(RETRY_DELAY);
        return fetchWithRetry(endpoint, options, retries - 1);
      }
      throw new Error('Network error. Please check your internet connection and try again.');
    }

    // Handle timeout errors
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      if (retries > 0) {
        console.warn(`Request timeout, retrying... (${retries} attempts remaining)`);
        await sleep(RETRY_DELAY);
        return fetchWithRetry(endpoint, options, retries - 1);
      }
      throw new Error('Request timed out. Please try again later.');
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      throw new Error('Invalid response from server. Please try again later.');
    }

    // If we have retries left and it's not a specific error type, retry
    if (retries > 0) {
      console.warn(`Request failed, retrying... (${retries} attempts remaining)`);
      await sleep(RETRY_DELAY);
      return fetchWithRetry(endpoint, options, retries - 1);
    }

    // If we're out of retries, throw the error
    throw error;
  }
}

// Cache management
function getCacheKey(endpoint: string, params?: any): string {
  return `${endpoint}${params ? JSON.stringify(params) : ''}`;
}

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// API functions with caching
export async function initiateGasLoanSwap(request: GasLoanRequest): Promise<GasLoanResponse> {
  return fetchWithRetry<GasLoanResponse>('/token-scanner/swap/quote', {
    method: 'POST',
    body: JSON.stringify({
      token: request.token,
      walletAddress: request.userAddress
    }),
  });
}

export async function getStakingStatus(address: string): Promise<StakingStatus> {
  // TODO: Replace with actual API call
  return {
    totalStaked: "1000 SUI",
    rewards: "50 SUI",
    validatorAddress: "0x123...abc",
    startDate: "2024-01-01",
    isActive: true,
  };
}

export async function initiateWithdrawal(request: WithdrawRequest): Promise<WithdrawResponse> {
  return fetchWithRetry<WithdrawResponse>('/staking/withdraw', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getTransactionHistory(params: { page: number; limit: number }): Promise<TransactionHistory> {
  // TODO: Replace with actual API call
  return {
    transactions: [
      {
        id: "1",
        type: "STAKE",
        status: "COMPLETED",
        amount: "100 SUI",
        timestamp: "2024-01-01T00:00:00Z",
        transactionHash: "0x123...abc",
        validatorAddress: "0x456...def",
      },
    ],
    total: 1,
    page: params.page,
    limit: params.limit,
  };
}

// Cache invalidation
export function invalidateCache(endpoint: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(endpoint)) {
      cache.delete(key);
    }
  }
}