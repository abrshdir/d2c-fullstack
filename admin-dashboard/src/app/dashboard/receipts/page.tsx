"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// Mock data for demonstration
const MOCK_RECEIPTS = [
  {
    id: "nft1",
    userId: "0x123...abc",
    walletAddress: "0x123...abc",
    receiptType: "Loan Repayment",
    issueDate: "2023-12-01T10:30:00",
    tokenId: "#12345",
    transactionHash: "0xabc...123",
    metadata: {
      loanAmount: 0.05,
      repaymentDate: "2023-12-01",
      stakingParticipation: true,
      crossChainTransactions: 3,
    },
  },
  {
    id: "nft2",
    userId: "0x456...def",
    walletAddress: "0x456...def",
    receiptType: "Loan Repayment",
    issueDate: "2023-11-28T14:20:00",
    tokenId: "#12346",
    transactionHash: "0xdef...456",
    metadata: {
      loanAmount: 0.02,
      repaymentDate: "2023-11-28",
      stakingParticipation: true,
      crossChainTransactions: 1,
    },
  },
];

// Mock users who are eligible for receipts but don't have them yet
const MOCK_ELIGIBLE_USERS = [
  {
    id: "0x789...ghi",
    walletAddress: "0x789...ghi",
    loanAmount: 0.03,
    repaymentStatus: "completed",
    repaymentDate: "2023-12-05",
    stakingParticipation: false,
    crossChainTransactions: 0,
  },
];

export default function NFTReceipts() {
  const [receipts, setReceipts] = useState(MOCK_RECEIPTS);
  const [eligibleUsers, setEligibleUsers] = useState(MOCK_ELIGIBLE_USERS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(MOCK_RECEIPTS[0]);
  const [showModal, setShowModal] = useState(false);

  // In a real application, you would fetch this data from your backend
  useEffect(() => {
    // Simulate API call
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleIssueReceipt = (userId: any) => {
    // In a real application, this would call an API to issue an NFT receipt
    setIsLoading(true);

    // Simulate API call delay
    setTimeout(() => {
      // Remove user from eligible list
      const user = eligibleUsers.find((u) => u.id === userId);
      setEligibleUsers(eligibleUsers.filter((u) => u.id !== userId));
    
      if(!user) {
        return alert("User not found");
      }

      // Create a new receipt
      const newReceipt = {
        id: `nft${Date.now()}`,
        userId: user.id,
        walletAddress: user.walletAddress,
        receiptType: "Loan Repayment",
        issueDate: new Date().toISOString(),
        tokenId: `#${Math.floor(10000 + Math.random() * 90000)}`,
        transactionHash: `0x${Math.random().toString(16).substr(2, 40)}`,
        metadata: {
          loanAmount: user.loanAmount,
          repaymentDate: user.repaymentDate,
          stakingParticipation: user.stakingParticipation,
          crossChainTransactions: user.crossChainTransactions,
        },
      };

      setReceipts([...receipts, newReceipt]);
      setIsLoading(false);

      // Show success message
      alert(`NFT receipt issued for user ${userId}`);
    }, 2000);
  };

  const viewReceiptDetails = (receipt: any) => {
    setSelectedReceipt(receipt);
    setShowModal(true);
  };

  return (
    <div>
      <div className="bg-white shadow sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            NFT Receipts
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            On-chain receipts issued as NFTs confirming loan repayment and
            eligibility for future benefits.
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Issued Receipts */}
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Issued Receipts
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                NFT receipts that have been issued to users.
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {receipts.length > 0 ? (
                receipts.map((receipt) => (
                  <li key={receipt.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {receipt.walletAddress}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Token ID: {receipt.tokenId}
                        </p>
                      </div>
                      <button
                        onClick={() => viewReceiptDetails(receipt)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Details
                      </button>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Issued:{" "}
                        {new Date(receipt.issueDate).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        Tx: {receipt.transactionHash}
                      </p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 sm:px-6 text-center text-gray-500">
                  No receipts have been issued yet.
                </li>
              )}
            </ul>
          </div>

          {/* Eligible Users */}
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Eligible Users
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Users who have completed loan repayment and are eligible for NFT
                receipts.
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {eligibleUsers.length > 0 ? (
                eligibleUsers.map((user) => (
                  <li key={user.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {user.walletAddress}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Loan: {user.loanAmount} ETH
                        </p>
                      </div>
                      <button
                        onClick={() => handleIssueReceipt(user.id)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Issue Receipt
                      </button>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Repaid: {user.repaymentDate}
                      </p>
                      <p className="text-sm text-gray-500">
                        Staking: {user.stakingParticipation ? "Yes" : "No"}
                      </p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-6 sm:px-6 text-center text-gray-500">
                  No eligible users at this time.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Receipt Details Modal */}
      {showModal && selectedReceipt && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3
                      className="text-lg leading-6 font-medium text-gray-900"
                      id="modal-title"
                    >
                      NFT Receipt Details
                    </h3>
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Token ID
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedReceipt.tokenId}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Receipt Type
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedReceipt.receiptType}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Wallet Address
                          </p>
                          <p className="text-sm text-gray-900 truncate">
                            {selectedReceipt.walletAddress}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Issue Date
                          </p>
                          <p className="text-sm text-gray-900">
                            {new Date(
                              selectedReceipt.issueDate
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-gray-500">
                            Transaction Hash
                          </p>
                          <p className="text-sm text-gray-900 truncate">
                            {selectedReceipt.transactionHash}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-500">
                          Metadata
                        </p>
                        <div className="mt-2 bg-gray-50 p-3 rounded-md">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">Loan Amount:</span>{" "}
                            {selectedReceipt.metadata.loanAmount} ETH
                          </p>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">Repayment Date:</span>{" "}
                            {selectedReceipt.metadata.repaymentDate}
                          </p>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">
                              Staking Participation:
                            </span>{" "}
                            {selectedReceipt.metadata.stakingParticipation
                              ? "Yes"
                              : "No"}
                          </p>
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">
                              Cross-Chain Transactions:
                            </span>{" "}
                            {selectedReceipt.metadata.crossChainTransactions}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-500">
                          NFT Preview
                        </p>
                        <div className="mt-2 bg-gray-100 p-4 rounded-md flex justify-center">
                          <div className="w-48 h-48 bg-indigo-100 rounded-md flex flex-col items-center justify-center p-4 border-2 border-indigo-300">
                            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2">
                              SUI
                            </div>
                            <p className="text-sm font-bold text-indigo-800">
                              Gas Loan Repayment
                            </p>
                            <p className="text-xs text-indigo-600 mt-1">
                              {selectedReceipt.tokenId}
                            </p>
                            <p className="text-xs text-indigo-600 mt-1 truncate w-full text-center">
                              {selectedReceipt.walletAddress.substring(0, 10)}
                              ...
                            </p>
                            <div className="mt-2 w-full h-1 bg-indigo-200"></div>
                            <p className="text-xs text-indigo-800 mt-2">
                              Verified Repayment
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
