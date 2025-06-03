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

## Security Considerations

1. **Access Control**: Only the contract owner can deposit funds and mark missed repayments
2. **Reentrancy Protection**: All fund transfers are protected against reentrancy attacks
3. **Input Validation**: All inputs are validated to prevent unexpected behavior
4. **Fee Limits**: Service fees are capped at 10% to prevent abuse

## Future Improvements

1. **Multi-token Support**: Extend to support multiple token types beyond USDC
2. **Governance**: Add DAO-based governance for parameter adjustments
3. **Yield Generation**: Allow escrowed funds to generate yield while in escrow
4. **Cross-chain Support**: Extend to additional chains beyond Ethereum and Polygon

## License

MIT
