"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Mock data for demonstration
const MOCK_USERS = [
  {
    id: "0x123...abc",
    walletAddress: "0x123...abc",
    loanAmount: 0.05,
    repaymentStatus: "pending",
    loanDate: "2023-11-15",
    dueDate: "2023-12-15",
    stakingParticipation: true,
    crossChainTransactions: 3,
    totalBridgedAmount: 0.8,
    stakingAmount: 0.5,
  },
  {
    id: "0x456...def",
    walletAddress: "0x456...def",
    loanAmount: 0.02,
    repaymentStatus: "completed",
    loanDate: "2023-11-10",
    dueDate: "2023-12-10",
    stakingParticipation: true,
    crossChainTransactions: 1,
    totalBridgedAmount: 0.2,
    stakingAmount: 0.15,
  },
  {
    id: "0x789...ghi",
    walletAddress: "0x789...ghi",
    loanAmount: 0.03,
    repaymentStatus: "overdue",
    loanDate: "2023-11-05",
    dueDate: "2023-12-05",
    stakingParticipation: false,
    crossChainTransactions: 0,
    totalBridgedAmount: 0.1,
    stakingAmount: 0,
  },
  {
    id: "0xabc...123",
    walletAddress: "0xabc...123",
    loanAmount: 0.04,
    repaymentStatus: "pending",
    loanDate: "2023-11-18",
    dueDate: "2023-12-18",
    stakingParticipation: true,
    crossChainTransactions: 2,
    totalBridgedAmount: 0.7,
    stakingAmount: 0.3,
  },
];

export default function Users() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(MOCK_USERS[0]);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    repaymentStatus: "",
    stakingParticipation: "",
  });

  // In a real application, you would fetch this data from your backend
  useEffect(() => {
    // Simulate API call
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleViewDetails = (user: any) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleIssueReceipt = (userId: any) => {
    // In a real application, this would call an API to issue an NFT receipt
    alert(`NFT receipt issued for user ${userId}`);
  };

  const handleFilterChange = (filterName: any, value: any) => {
    setFilters({
      ...filters,
      [filterName]: value,
    });
  };

  const filteredUsers = users.filter((user) => {
    if (
      filters.repaymentStatus &&
      user.repaymentStatus !== filters.repaymentStatus
    )
      return false;
    if (filters.stakingParticipation) {
      const isStaking = filters.stakingParticipation === "yes";
      if (user.stakingParticipation !== isStaking) return false;
    }
    return true;
  });

  const getStatusColor = (status: any) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-blue-100 text-blue-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <div className="bg-white shadow sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            Gas Loan Users
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Manage users who have received gas loans for cross-chain
            transactions.
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
                  Repayment Status
                </label>
                <select
                  id="status-filter"
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
              <div>
                <label
                  htmlFor="staking-filter"
                  className="block text-sm font-medium text-gray-700"
                >
                  Staking Participation
                </label>
                <select
                  id="staking-filter"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={filters.stakingParticipation}
                  onChange={(e) =>
                    handleFilterChange("stakingParticipation", e.target.value)
                  }
                >
                  <option value="">All Users</option>
                  <option value="yes">Staking</option>
                  <option value="no">Not Staking</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Wallet Address
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Loan Details
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
                    Activity
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.walletAddress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Amount: {user.loanAmount} ETH
                        </div>
                        <div className="text-sm text-gray-500">
                          Due: {user.dueDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            user.repaymentStatus
                          )}`}
                        >
                          {user.repaymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Staking:{" "}
                          {user.stakingParticipation ? (
                            <span className="text-green-600">
                              Yes ({user.stakingAmount} SUI)
                            </span>
                          ) : (
                            <span className="text-red-600">No</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Cross-Chain Tx: {user.crossChainTransactions}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(user)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Details
                        </button>
                        {user.repaymentStatus === "completed" && (
                          <button
                            onClick={() => handleIssueReceipt(user.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Issue Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No users found matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showModal && selectedUser && (
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
                      User Details
                    </h3>
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Wallet Address
                          </p>
                          <p className="text-sm text-gray-900 truncate">
                            {selectedUser.walletAddress}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Loan Date
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedUser.loanDate}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Loan Amount
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedUser.loanAmount} ETH
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Due Date
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedUser.dueDate}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Repayment Status
                          </p>
                          <p className="text-sm">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                selectedUser.repaymentStatus
                              )}`}
                            >
                              {selectedUser.repaymentStatus}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            Staking Participation
                          </p>
                          <p className="text-sm text-gray-900">
                            {selectedUser.stakingParticipation ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-gray-200 pt-4">
                        <h4 className="text-md font-medium text-gray-900">
                          Activity Summary
                        </h4>
                        <div className="mt-2 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Cross-Chain Transactions
                            </p>
                            <p className="text-sm text-gray-900">
                              {selectedUser.crossChainTransactions}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Total Bridged Amount
                            </p>
                            <p className="text-sm text-gray-900">
                              {selectedUser.totalBridgedAmount} ETH
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Staking Amount
                            </p>
                            <p className="text-sm text-gray-900">
                              {selectedUser.stakingAmount} SUI
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
                  href={`/dashboard/transactions?userId=${selectedUser.id}`}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  View Transactions
                </Link>
                {selectedUser.repaymentStatus === "completed" && (
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => {
                      handleIssueReceipt(selectedUser.id);
                      setShowModal(false);
                    }}
                  >
                    Issue NFT Receipt
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
