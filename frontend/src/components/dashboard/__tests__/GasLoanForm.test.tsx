import { render, screen, fireEvent, waitFor } from '@/lib/test-utils';
import { GasLoanForm } from '../GasLoanForm';
import { initiateGasLoanSwap } from '@/lib/api/api';

describe('GasLoanForm', () => {
  const mockProps = {
    evmAddress: '0x123...',
    suiAddress: '0x456...',
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form correctly', () => {
    render(<GasLoanForm {...mockProps} />);
    
    expect(screen.getByText('Initiate Gas Loan')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /initiate loan/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<GasLoanForm {...mockProps} />);
    
    const submitButton = screen.getByRole('button', { name: /initiate loan/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
    });
  });

  it('validates minimum amount', async () => {
    render(<GasLoanForm {...mockProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '0.1' } });

    const submitButton = screen.getByRole('button', { name: /initiate loan/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Amount must be at least 1 SUI')).toBeInTheDocument();
    });
  });

  it('handles successful loan initiation', async () => {
    const mockResponse = {
      loanId: '123',
      status: 'pending',
      message: 'Loan initiated successfully',
    };

    (initiateGasLoanSwap as jest.Mock).mockResolvedValueOnce(mockResponse);

    render(<GasLoanForm {...mockProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '10' } });

    const submitButton = screen.getByRole('button', { name: /initiate loan/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(initiateGasLoanSwap).toHaveBeenCalledWith({
        evmAddress: mockProps.evmAddress,
        suiAddress: mockProps.suiAddress,
        amount: 10,
      });
      expect(mockProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('handles API errors', async () => {
    const mockError = new Error('API Error');
    (initiateGasLoanSwap as jest.Mock).mockRejectedValueOnce(mockError);

    render(<GasLoanForm {...mockProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amountInput, { target: { value: '10' } });

    const submitButton = screen.getByRole('button', { name: /initiate loan/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to initiate loan')).toBeInTheDocument();
    });
  });
}); 