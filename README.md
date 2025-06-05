# Cross-Chain SUI Staking Protocol

This repository contains a complete implementation of a cross-chain staking protocol that enables users to stake their ERC-20 tokens (USDC) on Ethereum and earn rewards on the Sui blockchain. The system is designed to be gasless for users and trust-minimized, with all operations enforced on-chain.

## Project Overview

The protocol allows users to:

- Deposit USDC on Ethereum without paying gas fees
- Automatically bridge assets to Sui blockchain
- Stake assets on Sui to earn rewards
- Withdraw funds back to Ethereum
- Track positions and rewards in real-time

## Project Structure

The project consists of three main components:

1. **Smart Contracts** (`/smart-contracts`):

   - Ethereum contracts for managing deposits and withdrawals
   - Sui Move contracts for staking operations (`/smart-contracts/sui-contracts`)
   - Integration with Wormhole and Rubic protocols

2. **Backend Service** (`/backend-nestjs`):

   - NestJS service for monitoring and processing cross-chain operations
   - Event listeners for blockchain state changes
   - Relayer service for executing transactions
   - API endpoints for frontend integration

3. **Frontend** (`/frontend`):
   - Next.js web application
   - Real-time position tracking
   - Transaction status monitoring
   - Portfolio management interface

## Prerequisites

### System Requirements

- Node.js (v16 or higher)
- npm (v7 or higher) or yarn (v1.22 or higher)
- Git

### Blockchain Tools

- Sui CLI (latest version)
- MetaMask or compatible Web3 wallet
- Access to Ethereum and Sui RPC endpoints

### Development Environment

- Code editor (VS Code recommended)
- Terminal with bash/zsh support
- Docker (optional, for local development)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd third-try
```

### 2. Smart Contracts Setup

#### Ethereum Contracts

```bash
cd smart-contracts

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to testnet
npx hardhat run scripts/deploy.js --network <network>
```

#### Sui Move Contracts

```bash
cd smart-contracts/sui-contracts

# Build the contracts
sui move build

# Run tests
sui move test

# Publish the contracts
sui client publish --gas-budget 100000000
```

### 3. Backend Service Setup

```bash
cd backend-nestjs

# Install dependencies
npm install

# Build the project
npm run build

# Start the service in development mode
npm run start:dev

# Start the service in production mode
npm run start:prod
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## How It Works

### Architecture Overview

The system implements a cross-chain staking protocol with the following key features:

1. **Gasless User Experience**

   - Users sign EIP-2612 permits instead of paying gas
   - All transactions are executed by a relayer
   - Meta-transactions for all user actions
   - Automatic gas fee handling by the protocol

2. **Cross-Chain Operations**

   - USDC deposits on Ethereum
   - Token swaps via Rubic SDK
   - Wormhole bridge for cross-chain transfers
   - SUI staking and reward accrual
   - Automatic bridging back to Ethereum

3. **Security & Trust Minimization**
   - All state changes are enforced on-chain
   - Relayer cannot misappropriate funds
   - Complete audit trail through events
   - Multi-signature requirements for critical operations

### Key Components

#### Smart Contracts

- `CollateralLock`: Main Ethereum contract managing deposits and withdrawals
- `RubicSwapExecutor`: Handles token swaps on Ethereum
- `StakeModule`: Sui Move contract handling staking operations
- `BridgeReceiver`: Sui Move contract for receiving bridged assets
- `RewardDistributor`: Sui Move contract for managing rewards
- Integration with Wormhole and Rubic protocols

#### Backend Service

- Monitors cross-chain events
- Processes user requests
- Manages relayer operations
- Handles token swaps and bridging
- Provides REST API endpoints
- Real-time event processing
- Database management for off-chain state

#### Frontend

- User-friendly interface for staking operations
- Real-time position tracking
- Transaction status monitoring
- Portfolio management
- Wallet integration
- Transaction history
- Analytics dashboard

## Important Addresses

### Ethereum Mainnet

- **USDC**: `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- **Wormhole TokenBridge**: `0x3ee18B2214AFF97000D974cf647E7C347E8fa585`
- **Sui Bridge**: `0xda3bD1fE1973470312db04551B65f401Bc8a92fD`

### Sui Mainnet

- **Wormhole TokenBridge**: `0xc57508ee0d4595e5a8728974a4a93a787d38f339757230d441e895422c07aba9`
- **Wormhole Core**: `0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c`

## Development

### Testing

Each component has its own test suite:

```bash
# Smart contracts (Ethereum)
cd smart-contracts
npx hardhat test

# Smart contracts (Sui)
cd smart-contracts/sui-contracts
sui move test

# Backend
cd backend-nestjs
npm run test

# Frontend
cd frontend
npm run test
```

### Environment Variables

Create `.env` files in each directory with the following variables:

```env
# Smart Contracts
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
ALCHEMY_API_KEY=your_alchemy_api_key

# Backend
ETHEREUM_RPC_URL=your_ethereum_rpc_url
POLYGON_RPC_URL=your_polygon_rpc_url
SUI_RPC_URL=your_sui_rpc_url
RELAYER_PRIVATE_KEY=your_relayer_private_key
SUI_RELAYER_PRIVATE_KEY=your_sui_relayer_private_key
DATABASE_URL=your_database_url

# Frontend
NEXT_PUBLIC_ETHEREUM_RPC_URL=your_ethereum_rpc_url
NEXT_PUBLIC_SUI_RPC_URL=your_sui_rpc_url
NEXT_PUBLIC_API_URL=your_api_url
```

## Support

For support, please open an issue in the repository or contact the team at support@example.com.

## Security

If you discover a security vulnerability, please send an email to security@example.com. All security vulnerabilities will be promptly addressed.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
