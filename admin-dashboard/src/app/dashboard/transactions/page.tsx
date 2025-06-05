"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Mock data for demonstration
const MOCK_TRANSACTIONS = [
  {
    id: "tx1",
    userId: "0x123...abc",
    walletAddress: "0x123...abc",
    sourceChain: "Ethereum",
    targetChain: "SUI",
    amount: 0.5,
    status: "completed",
    timestamp: "2023-11-15T10:30:00",
    sourceTxHash: "0xabc...123",
    targetTxHash: "0xdef...456",
    gasLoanAmount: 0.05,
    repaymentStatus: "pending",
  },
  {
    id: "tx2",
    userId: "0x123...abc",
    walletAddress: "0x123...abc",
    sourceChain: "Polygon",
    targetChain: "SUI",
    amount: 0.3,
    status: "completed",
    timestamp: "2023-11-16T14:20:00",
    sourceTxHash: "0xghi...789",
    targetTxHash: "0xjkl...012",
    gasLoanAmount: 0.05,
    repaymentStatus: "pending",
  },
  {
    id: "tx3",
    userId: "0x456...def",
    walletAddress: "0x456...def",
    sourceChain: "BSC",
    targetChain: "SUI",
    amount: 0.2,
    status: "completed",
    timestamp: "2023-11-12T09:15:00",
    sourceTxHash: "0xmno...345",
    targetTxHash: "0xpqr...678",
    gasLoanAmount: 0.02,
    repaymentStatus: "completed",
  },
  {
    id: "tx4",
    userId: "0x789...ghi",
    walletAddress: "0x789...ghi",
    sourceChain: "Avalanche",
    targetChain: "SUI",
    amount: 0.1,
    status: "failed",
    timestamp: "2023-11-18T16:45:00",
    sourceTxHash: "0xstu...901",
    targetTxHash: null,
    gasLoanAmount: 0.03,
    repaymentStatus: "overdue",
  },
  {
    id: "tx5",
    userId: "0xabc...123",
    walletAddress: "0xabc...123",
    sourceChain: "Arbitrum",
    targetChain: "SUI",
    amount: 0.7,
    status: "pending",
    timestamp: "2023-11-19T11:30:00",
    sourceTxHash: "0xvwx...234",
    targetTxHash: null,
    gasLoanAmount: 0.04,
    repaymentStatus: "pending",
  },
];

export default function Transactions() {
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(MOCK_TRANSACTIONS[0]);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    sourceChain: "",
    repaymentStatus: "",
  });

  // In a real application, you would fetch this data from your backend
  useEffect(() => {
    // Simulate API call
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleViewDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  const handleFilterChange = (filterName: any, value: any) => {
    setFilters({
      ...filters,
      [filterName]: value,
    });
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filters.status && tx.status !== filters.status) return false;
    if (filters.sourceChain && tx.sourceChain !== filters.sourceChain)
      return false;
    if (
      filters.repaymentStatus &&
      tx.repaymentStatus !== filters.repaymentStatus
    )
      return false;
    return true;
  });

  const getStatusColor = (status: any) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "overdue":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const uniqueSourceChains = [
    ...new Set(transactions.map((tx) => tx.sourceChain)),
  ];

  return (
    <div>
      <div className="bg-white shadow sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            Cross-Chain Transactions
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Monitor all cross-chain transactions and gas loan repayment status.
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
        <div>
          {/* Filters */}
          <div className="bg-white shadow sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6 flex flex-wrap gap-4">
              <div>
                <label
                  htmlFor="status-filter"
                  className="block text-sm font-medium text-gray-700"
                >
                  Transaction Status
                </label>
                <select
                  id="status-filter"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="chain-filter"
                  className="block text-sm font-medium text-gray-700"
                >
                  Source Chain
                </label>
                <select
                  id="chain-filter"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={filters.sourceChain}
                  onChange={(e) =>
                    handleFilterChange("sourceChain", e.target.value)
                  }
                >
                  <option value="">All Chains</option>
                  {uniqueSourceChains.map((chain) => (
                    <option key={chain} value={chain}>
                      {chain}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="repayment-filter"
                  className="block text-sm font-medium text-gray-700"
                >
                  Repayment Status
                </label>
                <select
                  id="repayment-filter"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={filters.repaymentStatus}
                  onChange={(e) =>
                    handleFilterChange("repaymentStatus", e.target.value)
                  }
                >
                  <option value="">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    User
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    From → To
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Gas Loan
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.walletAddress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.sourceChain} → {transaction.targetChain}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.amount} ETH
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {transaction.gasLoanAmount} ETH
                        </div>
                        <div>
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              transaction.repaymentStatus
                            )}`}
                          >
                            {transaction.repaymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(transaction)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No transactions found matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showModal && selectedTransaction && (
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
                      Transaction Details
                    </h3>
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            User
                          </p>
                          <p className="text-sm text-gray-900 truncate">
                            {selectedTransaction.walletAddress}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Date & Time
                          </p>
                          <p className="text-sm text-gray-900">
                            {new Date(
                              selectedTransaction.timestamp
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Source Chain
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedTransaction.sourceChain}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Target Chain
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedTransaction.targetChain}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Amount
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedTransaction.amount} ETH
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Status
                          </p>
                          <p className="text-sm">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                selectedTransaction.status
                              )}`}
                            >
                              {selectedTransaction.status}
                            </span>
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-gray-500">
                            Source Transaction Hash
                          </p>
                          <p className="text-sm text-gray-900 font-mono break-all">
                            {selectedTransaction.sourceTxHash}
                          </p>
                        </div>
                        {selectedTransaction.targetTxHash && (
                          <div className="col-span-2">
                            <p className="text-sm font-medium text-gray-500">
                              Target Transaction Hash
                            </p>
                            <p className="text-sm text-gray-900 font-mono break-all">
                              {selectedTransaction.targetTxHash}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 border-t border-gray-200 pt-4">
                        <h4 className="text-md font-medium text-gray-900">
                          Gas Loan Details
                        </h4>
                        <div className="mt-2 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Loan Amount
                            </p>
                            <p className="text-sm text-gray-900">
                              {selectedTransaction.gasLoanAmount} ETH
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Repayment Status
                            </p>
                            <p className="text-sm">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                  selectedTransaction.repaymentStatus
                                )}`}
                              >
                                {selectedTransaction.repaymentStatus}
                              </span>
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
                <Link
                  href={`/dashboard?userId=${selectedTransaction.userId}`}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  View User
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
