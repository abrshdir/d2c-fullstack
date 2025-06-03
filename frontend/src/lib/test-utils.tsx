import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { Toaster } from '@/components/ui/toaster';

function render(ui: React.ReactElement, options = {}) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <>
        {children}
        <Toaster />
      </>
    ),
    ...options,
  });
}

// Mock the API client
jest.mock('@/lib/api/api', () => ({
  initiateGasLoanSwap: jest.fn(),
  getStakingStatus: jest.fn(),
  initiateWithdrawal: jest.fn(),
  getTransactionHistory: jest.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

export * from '@testing-library/react';
export { render }; 