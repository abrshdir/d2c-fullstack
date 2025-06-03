"use client";

import React, { useState } from 'react';
import { initiateWithdrawal } from '../lib/api/api'; // Import the placeholder API function

const WithdrawPage: React.FC = () => {
  const [loanId, setLoanId] = useState('');
  const [status, setStatus] = useState('');

  const handleWithdraw = async () => {
    setStatus('Initiating withdrawal...');
    try {
      // Placeholder API call to initiate withdrawal
      // Replace with actual API call when backend is ready
      const response = await initiateWithdrawal({ loanId });
      setStatus(`Withdrawal initiated: ${response.status}`);
      // Handle successful withdrawal (e.g., show transaction hash)
    } catch (error: any) {
      setStatus(`Withdrawal failed: ${error.message}`);
      // Handle errors
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Initiate Withdrawal</h1>
      <div className="mb-4">
        <label htmlFor="loanId" className="block text-gray-700 text-sm font-bold mb-2">
          Loan ID:
        </label>
        <input
          type="text"
          id="loanId"
          value={loanId}
          onChange={(e) => setLoanId(e.target.value)}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>
      <button
        onClick={handleWithdraw}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
      >
        Withdraw
      </button>
      {status && <p className="mt-4">{status}</p>}
    </div>
  );
};

export default WithdrawPage;