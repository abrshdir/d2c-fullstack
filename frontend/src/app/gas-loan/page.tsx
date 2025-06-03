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
      // Actual call to the API service
      const response = await initiateGasLoanSwap({ // Assuming GasLoanRequest is compatible
        amount: amount, // This might be 'value' depending on GasLoanRequest in api.ts
        tokenAddress: selectedToken,
        permit: permitData, // Ensure this structure matches what initiateGasLoanSwap expects
        // Placeholder: these might need to be passed or derived if not in permitData
        // userAddress: walletClient?.account?.address,
        // chainId: walletClient?.chain?.id?.toString(),
      });

      setLoanStatus(response); // Update state with the GasLoanResult

      if (response.success) {
        // Clear form or give success feedback
        console.log('Gas loan swap successful:', response);
      } else {
        setError(response.error || 'Gas loan swap failed for an unknown reason.');
      }

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
          <h2 className="text-xl font-semibold mb-2">Gas Loan Swap Status</h2>
          {loanStatus.success ? (
            <>
              <p className="text-green-600">Swap Successful!</p>
              <p>Transaction Hash: {loanStatus.transactionHash}</p>
              <p>USDC Obtained: {loanStatus.usdcObtained} USDC</p>
              <p>Gas Cost (Loan Amount): {loanStatus.loanAmount} USDC</p>
              <p className="font-semibold mt-2">
                The swapped {loanStatus.usdcObtained} USDC has been deposited into the Dust2Cash Escrow contract.
                Your outstanding loan for gas ({loanStatus.loanAmount} USDC) is recorded in the escrow.
              </p>
              <p className="mt-2">
                Please visit your <a href="/dashboard" className="text-blue-500 hover:underline">Dashboard</a> to view and manage your loan.
              </p>
            </>
          ) : (
            <p className="text-red-600">Swap Failed: {loanStatus.error || "Unknown error"}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default GasLoanPage;