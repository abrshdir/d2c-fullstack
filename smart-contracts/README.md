# Dust2Cash Smart Contract System

This directory contains the smart contract implementation for the Dust2Cash gas-sponsored token extraction service. The smart contracts handle USDC escrow, gas loan tracking, and user reputation management to ensure secure and trustless operation.

## Overview

The Dust2Cash smart contract system solves a critical trust issue in the gas-sponsored token extraction flow. Previously, users could avoid repaying their gas loans by closing the application after receiving their swapped USDC. The new smart contract-based approach ensures that:

1. Swapped USDC is held in escrow until gas loan repayment
2. Gas loans are tracked on-chain
3. User reputation is maintained to incentivize good behavior
4. Funds are only released after successful repayment

## Contract Architecture

### Dust2CashEscrow.sol

The main contract that handles:

- **USDC Escrow**: Securely holds USDC after token swaps
- **Gas Loan Tracking**: Records outstanding gas debts for each user
- **Reputation Management**: Maintains user reputation scores (0-100)
- **Blacklisting**: Temporarily restricts users with poor repayment history
- **Fee Management**: Handles service fees for the platform

### MockUSDC.sol

A mock USDC token implementation for local testing and development.

## Key Features

1. **Secure Fund Management**

   - USDC is held in escrow until gas loan repayment
   - Only the contract owner (Dust2Cash service) can deposit funds on behalf of users
   - Users can only withdraw after repaying their gas loans

2. **Reputation System**

   - Users start with a default reputation score (70/100)
   - Successful repayments increase reputation
   - Missed repayments decrease reputation
   - Users with low reputation can be temporarily blacklisted

3. **Transparent Fee Structure**

   - Configurable service fee (default 2%)
   - Fees are collected during withdrawals

4. **Comprehensive Event Logging**
   - All important actions emit events for transparency and tracking

## Integration with Dust2Cash

### Backend Integration

The Dust2Cash backend needs to be updated to interact with the smart contract:

1. **Token Swap Service**

   - After successful token swap, deposit the USDC into the escrow contract
   - Track the transaction hash and gas cost
   - Call `depositForUser(userAddress, usdcAmount, gasDebt)` on the contract

2. **Repayment Service**

   - Update the repayment flow to interact with the smart contract
   - Monitor `GasLoanRepaid` events from the contract

3. **Withdrawal Service**
   - Allow users to withdraw funds through the contract
   - Monitor `FundsReleased` events from the contract

### Frontend Integration

The frontend components need to be updated to reflect the new contract-based flow:

1. **Wizard.tsx**

   - Update the flow to show escrow status
   - Remove direct bridging to SUI (funds stay on original chain)
   - Update repayment step to interact with the contract

2. **StakingFlow.tsx**
   - Modify to work with funds on Ethereum/Polygon instead of SUI
   - Add contract interaction for withdrawals
   - Update staking option to work with the original chain

## Backend Integration Functions

### 1. Wallet Scanning & Token Analysis
No direct smart contract integration needed at this stage. Backend should use Alchemy/Covalent APIs.

### 2. Gas Loan Offer & Token Swap
#### RubicSwapExecutor.sol
```solidity
function executeSwap(
    address _fromToken,
    address _toToken,
    uint256 _amount,
    bytes32 _quoteId,
    bytes calldata _swapData
) external nonReentrant
```
- **Purpose**: Execute token swap via Rubic
- **Backend Integration**:
  - Get quote from Rubic API
  - Prepare swap data
  - Call from relayer account
  - Track transaction hash

### 3. Smart Contract Escrow & Gas Loan Enforcement
#### Dust2CashEscrow.sol
```solidity
function depositForUser(
    address user,
    uint256 amount,
    uint256 gasDebt
) external onlyOwner nonReentrant whenNotPaused
```
- **Purpose**: Deposit swapped USDC and record gas debt
- **Backend Integration**:
  - Call after successful swap
  - Track user's escrow status
  - Monitor gas debt

```solidity
function markMissedRepayment(address user) external onlyOwner whenNotPaused
```
- **Purpose**: Mark user as having missed repayment
- **Backend Integration**:
  - Call if repayment deadline passes
  - Update user status in backend

### 4. Gas Loan Repayment & Fund Release
#### Dust2CashEscrow.sol
```solidity
function repayGasLoan(uint256 amount) external nonReentrant whenNotPaused
```
- **Purpose**: Allow user to repay gas loan
- **Backend Integration**:
  - Monitor repayment status
  - Update user's loan status

```solidity
function withdrawFunds() external nonReentrant whenNotPaused
```
- **Purpose**: Release remaining USDC after repayment
- **Backend Integration**:
  - Monitor withdrawal status
  - Update user's balance

### 5. SUI Staking Integration
#### CollateralLock.sol
```solidity
function stakeOnSui(uint8 discountRate) external nonReentrant
```
- **Purpose**: Stake collateral on SUI
- **Backend Integration**:
  - Monitor staking status
  - Track discount rate
  - Update user's staking status

```solidity
function finalizeRewards(
    address user,
    uint256 repayAmount,
    uint256 payoutAmount
) external onlyRelayer nonReentrant
```
- **Purpose**: Finalize staking rewards
- **Backend Integration**:
  - Track reward distribution
  - Update user's reward status

### 6. Treasury Management
#### Treasury.sol
```solidity
function fundRelayer(uint256 amount) external nonReentrant whenNotPaused onlyOperator
```
- **Purpose**: Fund relayer for gas operations
- **Backend Integration**:
  - Monitor relayer balance
  - Track gas funding

```solidity
function collectFees() external nonReentrant
```
- **Purpose**: Collect protocol fees
- **Backend Integration**:
  - Track fee collection
  - Update treasury status

### 7. Admin & Monitoring
#### Dust2CashEscrow.sol
```solidity
function getUserAccount(address user) external view returns (UserAccount memory)
```
- **Purpose**: Get user's account details
- **Backend Integration**:
  - Monitor user status
  - Track reputation
  - Check blacklist status

#### Treasury.sol
```solidity
function getTreasuryStatus() external view returns (
    uint256 balance,
    uint256 dailyLimit,
    uint256 withdrawnToday
)
```
- **Purpose**: Get treasury status
- **Backend Integration**:
  - Monitor treasury health
  - Track withdrawals
  - Update admin dashboard

## Integration Flow

1. **Initial Setup**
   - Deploy all contracts
   - Set up relayer account
   - Configure treasury
   - Initialize USDC addresses

2. **User Flow Integration**
   - Scan wallet (backend only)
   - Execute swap (RubicSwapExecutor)
   - Deposit to escrow (Dust2CashEscrow)
   - Monitor repayment (Dust2CashEscrow)
   - Handle withdrawal/staking (CollateralLock)
   - Track rewards (CollateralLock)

3. **Admin Flow Integration**
   - Monitor treasury (Treasury)
   - Track user status (Dust2CashEscrow)
   - Manage operators (Treasury)
   - Handle emergencies (Treasury)

4. **Monitoring & Analytics**
   - Track all contract events
   - Monitor gas usage
   - Track user reputation
   - Monitor treasury status
   - Track staking participation

## Security Considerations

1. **Access Control**
   - Only owner/operator can call sensitive functions
   - Use timelock for critical changes
   - Implement multi-sig for treasury operations

2. **Gas Optimization**
   - Batch operations when possible
   - Use efficient data structures
   - Optimize function parameters

3. **Error Handling**
   - Implement proper revert messages
   - Use require statements effectively
   - Handle edge cases

4. **Monitoring**
   - Track all contract events
   - Monitor gas usage
   - Track user reputation
   - Monitor treasury status

## Testing Requirements

1. **Unit Tests**
   - Test all contract functions
   - Verify access control
   - Test edge cases

2. **Integration Tests**
   - Test contract interactions
   - Verify user flows
   - Test admin functions

3. **Security Tests**
   - Test access control
   - Verify timelock
   - Test emergency functions

4. **Gas Tests**
   - Measure gas usage
   - Optimize functions
   - Test batch operations

## Deployment

### Prerequisites

- Node.js and npm installed
- Hardhat development environment
- Ethereum/Polygon RPC endpoints
- Private key for deployment

### Installation

```bash
npm install
```

### Compile Contracts

```bash
npm run compile
```

### Deploy to Networks

1. Create a `.env` file with the following variables:

```
PRIVATE_KEY=your_private_key
ETHEREUM_RPC_URL=your_ethereum_rpc_url
POLYGON_RPC_URL=your_polygon_rpc_url
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

2. Deploy to Ethereum:

```bash
npm run deploy:ethereum
```

3. Deploy to Polygon:

```bash
npm run deploy:polygon
```

## Testing

Run the test suite:

```bash
npm test
```

## Future Improvements

1. **Multi-token Support**: Extend to support multiple token types beyond USDC
2. **Governance**: Add DAO-based governance for parameter adjustments
3. **Yield Generation**: Allow escrowed funds to generate yield while in escrow
4. **Cross-chain Support**: Extend to additional chains beyond Ethereum and Polygon

## License

MIT
