import {
  initiateGasLoanSwap,
  getStakingStatus,
  initiateWithdrawal,
  getTransactionHistory,
  invalidateCache,
} from '../api';

describe('API Client', () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('initiateGasLoanSwap', () => {
    const mockRequest = {
      evmAddress: '0x123...',
      suiAddress: '0x456...',
      amount: 10,
    };

    it('successfully initiates a gas loan swap', async () => {
      const mockResponse = {
        loanId: '123',
        status: 'pending',
        message: 'Loan initiated successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await initiateGasLoanSwap(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/gas-loan/process-swap'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(mockRequest),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid request' }),
      });

      await expect(initiateGasLoanSwap(mockRequest)).rejects.toThrow('Invalid request');
    });
  });

  describe('getStakingStatus', () => {
    const mockLoanId = '123';

    it('successfully retrieves staking status', async () => {
      const mockResponse = {
        loanId: '123',
        stakedAmount: 10,
        rewards: 0.5,
        status: 'active',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getStakingStatus(mockLoanId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/staking/status/${mockLoanId}`),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Loan not found' }),
      });

      await expect(getStakingStatus(mockLoanId)).rejects.toThrow('Loan not found');
    });
  });

  describe('initiateWithdrawal', () => {
    const mockRequest = {
      loanId: '123',
      suiAddress: '0x456...',
      amount: 5,
    };

    it('successfully initiates a withdrawal', async () => {
      const mockResponse = {
        transactionId: 'tx123',
        status: 'pending',
        message: 'Withdrawal initiated successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await initiateWithdrawal(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/staking/withdraw'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(mockRequest),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Insufficient balance' }),
      });

      await expect(initiateWithdrawal(mockRequest)).rejects.toThrow('Insufficient balance');
    });
  });

  describe('getTransactionHistory', () => {
    const mockAddress = '0x123...';

    it('successfully retrieves transaction history', async () => {
      const mockResponse = {
        transactions: [
          {
            id: 'tx1',
            type: 'loan',
            amount: 10,
            status: 'completed',
            timestamp: '2024-03-20T10:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getTransactionHistory(mockAddress);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/transactions/history'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      });

      await expect(getTransactionHistory(mockAddress)).rejects.toThrow('Internal server error');
    });
  });

  describe('Cache Management', () => {
    it('invalidates cache for a specific endpoint', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // First call - should hit the API
      await getStakingStatus('123');

      // Second call - should use cache
      await getStakingStatus('123');

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Invalidate cache
      invalidateCache('/staking/status/123');

      // Third call - should hit the API again
      await getStakingStatus('123');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
}); 