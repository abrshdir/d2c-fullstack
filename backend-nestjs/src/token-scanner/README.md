# Gas-Sponsored Token Swap Service

## Overview

This service identifies valuable tokens in user wallets and offers to swap them to USDC using Rubic's SDK. The service is designed to help users with "stranded value" - tokens that are valuable but can't be moved due to lack of gas funds.

## Key Components

### 1. Token Scanner Service

- Scans wallets for tokens and identifies if they have stranded value
- Returns top tokens by value and indicates if gas-sponsored swaps are available

### 2. Rubic Swap Service

- Integrates with Rubic's API to find the best swap paths across multiple DEXs
- Gets quotes for token swaps to USDC
- Executes gas-sponsored transactions using a relayer wallet

### 3. Swap Transaction Service

- Tracks all executed swaps
- Records USDC obtained and gas costs for loan repayment tracking
- Provides endpoints to view outstanding debt and mark transactions as paid

## API Endpoints

### Token Scanner

- `GET /token-scanner/scan?walletAddress={address}` - Scan a wallet for tokens and check for stranded value

### Rubic Swap

- `POST /token-scanner/swap/quote` - Get a quote for swapping a token to USDC
- `POST /token-scanner/swap/execute` - Execute a gas-sponsored swap
- `GET /token-scanner/swap/transactions/{walletAddress}` - Get all swap transactions for a wallet
- `GET /token-scanner/swap/debt/{walletAddress}` - Get outstanding debt for a wallet
- `POST /token-scanner/swap/mark-paid/{transactionId}` - Mark a transaction as paid

## Configuration

The following environment variables are required:

```
RELAYER_PRIVATE_KEY=your_relayer_wallet_private_key
ETHEREUM_RPC_URL=your_ethereum_rpc_url
POLYGON_RPC_URL=your_polygon_rpc_url
```

## Implementation Details

1. **Permit-Based Approvals**: The service uses permit-based token approvals where available to save on upfront gas costs.

2. **Gas Sponsorship**: The relayer wallet pays for the gas costs of the swap transaction, which are tracked for later repayment.

3. **Multi-DEX Routing**: Rubic's quoteBest API is used to find optimal swap paths across multiple DEXs.

4. **Debt Tracking**: The service tracks the amount of USDC obtained and the gas cost for each transaction, allowing for loan repayment tracking.
