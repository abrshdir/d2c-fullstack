// frontend-new/src/lib/api/api.ts

import {
  GasLoanRequest,
  GasLoanResponse,
  StakingStatus,
  WithdrawRequest,
  WithdrawResponse,
  TransactionHistory,
  Error,
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
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: Error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  } catch (error) {
    if (retries > 0) {
      await sleep(RETRY_DELAY);
      return fetchWithRetry(endpoint, options, retries - 1);
    }
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
  return fetchWithRetry<GasLoanResponse>('/gas-loan/process-swap', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getStakingStatus(loanId: string): Promise<StakingStatus> {
  const cacheKey = getCacheKey(`/staking/status/${loanId}`);
  const cached = getCachedData<StakingStatus>(cacheKey);
  
  if (cached) {
    return cached;
  }

  const data = await fetchWithRetry<StakingStatus>(`/staking/status/${loanId}`);
  setCachedData(cacheKey, data);
  return data;
}

export async function initiateWithdrawal(request: WithdrawRequest): Promise<WithdrawResponse> {
  return fetchWithRetry<WithdrawResponse>('/staking/withdraw', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getTransactionHistory(
  page: number = 1,
  limit: number = 10
): Promise<TransactionHistory> {
  const cacheKey = getCacheKey('/transactions/history', { page, limit });
  const cached = getCachedData<TransactionHistory>(cacheKey);
  
  if (cached) {
    return cached;
  }

  const data = await fetchWithRetry<TransactionHistory>(
    `/transactions/history?page=${page}&limit=${limit}`
  );
  setCachedData(cacheKey, data);
  return data;
}

// Cache invalidation
export function invalidateCache(endpoint: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(endpoint)) {
      cache.delete(key);
    }
  }
}