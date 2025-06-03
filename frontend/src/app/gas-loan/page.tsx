// frontend-new/src/app/gas-loan/page.tsx
'use client';

import React, { useState } from 'react';
import { initiateGasLoanSwap } from '../../lib/api/api'; // Import the placeholder API function
import { TokenSelection } from '../../components/TokenSelection'; // Assume this component exists
import { PermitForm } from '../../components/PermitForm'; // Assume this component exists

const GasLoanPage: React.FC = () => {
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [permitData, setPermitData] = useState<any>(null); // Placeholder for permit data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loanStatus, setLoanStatus] = useState<any>(null); // Placeholder for loan status

  const handleTokenSelect = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handlePermitGenerated = (permit: any) => {
    setPermitData(permit);
  };

  const handleSubmit = async () => {
    if (!selectedToken || !amount || !permitData) {
      setError('Please select a token, enter amount, and generate permit.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Call the initiateGasLoanSwap API function here
      // const response = await initiateGasLoanSwap({
      //   amount: amount,
      //   tokenAddress: selectedToken,
      //   permit: permitData,
      // });
      // setLoanStatus(response); // Update state with the loan status from API
      console.log('Initiating gas loan swap with:', { selectedToken, amount, permitData });
      // Placeholder for successful API call response
      setLoanStatus({ loanId: 'fake-loan-123', status: 'PENDING', transactionHash: 'fake-tx-abc', estimatedGasCost: '0.001' });

    } catch (err: any) {
      setError(err.message || 'Failed to initiate gas loan swap.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Initiate Gas Loan and Swap</h1>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Select Token</h2>
        {/* Assume TokenSelection component handles token fetching and selection */}
        <TokenSelection onSelectToken={handleTokenSelect} />
        {selectedToken && <p>Selected Token: {selectedToken}</p>}
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Enter Amount</h2>
        <input
          type="text"
          className="border p-2 rounded w-full"
          value={amount}
          onChange={handleAmountChange}
          placeholder="Enter amount"
        />
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Generate Permit</h2>
        {/* Assume PermitForm component handles permit generation */}
        <PermitForm onPermitGenerated={handlePermitGenerated} />
        {permitData && <p>Permit Data Generated</p>}
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <button
        className={`bg-blue-500 text-white p-2 rounded ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleSubmit}
        disabled={loading || !selectedToken || !amount || !permitData}
      >
        {loading ? 'Processing...' : 'Initiate Swap'}
      </button>

      {loanStatus && (
        <div className="mt-4 p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Loan Status</h2>
          <p>Loan ID: {loanStatus.loanId}</p>
          <p>Status: {loanStatus.status}</p>
          {loanStatus.transactionHash && <p>Transaction Hash: {loanStatus.transactionHash}</p>}
          {loanStatus.estimatedGasCost && <p>Estimated Gas Cost: {loanStatus.estimatedGasCost}</p>}
        </div>
      )}
    </div>
  );
};

export default GasLoanPage;