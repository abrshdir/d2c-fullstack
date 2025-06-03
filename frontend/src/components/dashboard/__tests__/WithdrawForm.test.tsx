import { render, screen, fireEvent, waitFor } from '@/lib/test-utils';
import { WithdrawForm } from '../WithdrawForm';
import { initiateWithdrawal } from '@/lib/api/api';

describe('WithdrawForm', () => {
  const mockProps = {
    loanId: '123',
    suiAddress: '0x456...',
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form correctly', () => {
    render(<WithdrawForm {...mockProps} />);
    
    expect(screen.getByText('Withdraw Funds')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<WithdrawForm {...mockProps} />);
    
    const submitButton = screen.getByRole('button', { name: /withdraw/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
    });
  });

  it('validates minimum amount', async () => {
    render(<WithdrawForm {...mockProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '0.1' } });

    const submitButton = screen.getByRole('button', { name: /withdraw/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Amount must be at least 1 SUI')).toBeInTheDocument();
    });
  });

  it('handles successful withdrawal', async () => {
    const mockResponse = {
      transactionId: 'tx123',
      status: 'pending',
      message: 'Withdrawal initiated successfully',
    };

    (initiateWithdrawal as jest.Mock).mockResolvedValueOnce(mockResponse);

    render(<WithdrawForm {...mockProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '10' } });

    const submitButton = screen.getByRole('button', { name: /withdraw/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(initiateWithdrawal).toHaveBeenCalledWith({
        loanId: mockProps.loanId,
        suiAddress: mockProps.suiAddress,
        amount: 10,
      });
      expect(mockProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('handles API errors', async () => {
    const mockError = new Error('API Error');
    (initiateWithdrawal as jest.Mock).mockRejectedValueOnce(mockError);

    render(<WithdrawForm {...mockProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '10' } });

    const submitButton = screen.getByRole('button', { name: /withdraw/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to initiate withdrawal')).toBeInTheDocument();
    });
  });
}); 