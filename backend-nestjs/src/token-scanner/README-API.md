# Stranded Value Scanner API Documentation

This document provides a comprehensive list of API endpoints available for the Stranded Value Scanner application, including token scanning, swapping, and cross-chain bridging functionality.

## Base URL

All API endpoints are relative to the base URL of your deployed application.

## Token Scanner Endpoints

### Scan Wallet for Tokens

```
GET /token-scanner/scan/:walletAddress
```

Scans a wallet address for tokens on Ethereum and Polygon networks and identifies stranded value.

**Parameters:**

- `walletAddress` (path): The Ethereum wallet address to scan

**Response:**

```json
{
  "topTokens": [
    {
      "chainId": "1",
      "tokenAddress": "0x...",
      "symbol": "TOKEN",
      "name": "Token Name",
      "decimals": 18,
      "balance": "0x...",
      "balanceFormatted": 10.5,
      "usdValue": 25.75
    }
  ],
  "hasStrandedValue": true
}
```

## Repayment Endpoints

### Process Repayment

```
POST /token-scanner/repayment/process
```

Process a USDC repayment on SUI network, deducting the gas loan debt from the bridged amount.

**Request Body:**

```json
{
  "walletAddress": "0x...",
  "bridgedAmount": "10.5"
}
```

**Response:**

```json
{
  "walletAddress": "0x...",
  "amountRepaid": "2.5",
  "remainingBalance": "8.0",
  "transactionsPaid": ["transaction-id-1", "transaction-id-2"],
  "timestamp": 1678901234567,
  "status": "CONFIRMED"
}
```

### Get Wallet Repayments

```
GET /token-scanner/repayment/:walletAddress
```

Get all repayment records for a specific wallet address.

**Response:**

```json
[
  {
    "walletAddress": "0x...",
    "amountRepaid": "2.5",
    "remainingBalance": "8.0",
    "transactionsPaid": ["transaction-id-1", "transaction-id-2"],
    "timestamp": 1678901234567,
    "status": "CONFIRMED"
  }
]
```

### Get Unlocked Balance

```
GET /token-scanner/repayment/unlocked-balance/:walletAddress
```

Get the unlocked USDC balance for a wallet after debt repayment.

**Response:**

```json
{
  "walletAddress": "0x...",
  "unlockedBalance": "8.0"
}
```

## Swap Endpoints

### Get Swap Quote

```
POST /token-scanner/swap/quote
```

Get a quote for swapping a token to USDC on the same chain (Ethereum or Polygon).

**Request Body:**

```json
{
  "token": {
    "chainId": "1",
    "tokenAddress": "0x...",
    "symbol": "TOKEN",
    "name": "Token Name",
    "decimals": 18,
    "balance": "0x...",
    "balanceFormatted": 10.5,
    "usdValue": 25.75
  },
  "walletAddress": "0x..."
}
```

**Response:**

```json
{
  "id": "quote-id",
  "srcTokenAddress": "0x...",
  "srcTokenAmount": "10.5",
  "srcTokenBlockchain": "ETH",
  "dstTokenAddress": "0x...",
  "dstTokenBlockchain": "ETH",
  "destinationTokenAmount": "25.75",
  "destinationTokenMinAmount": "25.5",
  "priceImpact": 0.5,
  "provider": "1inch",
  "estimatedGasFee": "0.005"
}
```

### Execute Gas-Sponsored Swap

```
POST /token-scanner/swap/execute
```

Execute a gas-sponsored swap from a token to USDC on the same chain.

**Request Body:**

```json
{
  "token": {
    "chainId": "1",
    "tokenAddress": "0x...",
    "symbol": "TOKEN",
    "name": "Token Name",
    "decimals": 18,
    "balance": "0x...",
    "balanceFormatted": 10.5,
    "usdValue": 25.75
  },
  "walletAddress": "0x..."
}
```

**Response:**

```json
{
  "id": "transaction-id",
  "walletAddress": "0x...",
  "tokenSymbol": "TOKEN",
  "tokenAddress": "0x...",
  "chainId": "1",
  "transactionHash": "0x...",
  "usdcObtained": "25.75",
  "gasCost": "0.005",
  "timestamp": 1621234567,
  "isPaid": false
}
```

### Get Wallet Transactions

```
GET /token-scanner/swap/transactions/:walletAddress
```

Get all swap transactions for a wallet address.

**Parameters:**

- `walletAddress` (path): The Ethereum wallet address

**Response:**

```json
[
  {
    "id": "transaction-id",
    "walletAddress": "0x...",
    "tokenSymbol": "TOKEN",
    "tokenAddress": "0x...",
    "chainId": "1",
    "transactionHash": "0x...",
    "usdcObtained": "25.75",
    "gasCost": "0.005",
    "timestamp": 1621234567,
    "isPaid": false
  }
]
```

### Get Wallet Debt

```
GET /token-scanner/swap/debt/:walletAddress
```

Get the total outstanding debt for a wallet address.

**Parameters:**

- `walletAddress` (path): The Ethereum wallet address

**Response:**

```json
{
  "outstandingDebt": 25.75
}
```

### Mark Transaction as Paid

```
POST /token-scanner/swap/mark-paid/:transactionId
```

Mark a swap transaction as paid.

**Parameters:**

- `transactionId` (path): The transaction ID

**Response:**

```json
{
  "success": true
}
```

## SUI Bridge Endpoints

### Get Bridge Quote

```
POST /token-scanner/bridge/quote
```

Get a quote for bridging USDC from Ethereum or Polygon to SUI network.

**Request Body:**

```json
{
  "token": {
    "chainId": "1",
    "tokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC on Ethereum
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "balance": "0x...",
    "balanceFormatted": 100.0,
    "usdValue": 100.0
  },
  "walletAddress": "0x..."
}
```

**Response:**

```json
{
  "id": "quote-id",
  "srcTokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "srcTokenAmount": "100.0",
  "srcTokenBlockchain": "ETH",
  "dstTokenAddress": "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
  "dstTokenBlockchain": "SUI",
  "destinationTokenAmount": "99.5",
  "destinationTokenMinAmount": "99.0",
  "priceImpact": 0.5,
  "provider": "Wormhole",
  "estimatedGasFee": "0.01",
  "bridgeFee": "0.5",
  "estimatedTime": "30"
}
```

### Execute Gas-Sponsored Bridge

```
POST /token-scanner/bridge/execute?destinationAddress=<sui_address>
```

Execute a gas-sponsored bridge from USDC on Ethereum/Polygon to USDC on SUI network.

**Query Parameters:**

- `destinationAddress` (optional): The SUI wallet address to receive the bridged tokens. If not provided, the source wallet address will be used.

**Request Body:**

```json
{
  "token": {
    "chainId": "1",
    "tokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC on Ethereum
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "balance": "0x...",
    "balanceFormatted": 100.0,
    "usdValue": 100.0
  },
  "walletAddress": "0x..."
}
```

**Response:**

```json
{
  "transactionHash": "0x...",
  "usdcObtained": "99.5",
  "gasCost": "0.01",
  "timestamp": 1621234567,
  "bridgeProvider": "Wormhole",
  "estimatedArrivalTime": 1621236367, // timestamp when tokens are expected to arrive on SUI
  "status": "PENDING"
}
```

### Check Bridge Status

```
GET /token-scanner/bridge/status/:transactionHash
```

Check the status of a bridge transaction.

**Parameters:**

- `transactionHash` (path): The transaction hash of the bridge transaction

**Response:**

```json
{
  "status": "PENDING", // PENDING, COMPLETED, or FAILED
  "transactionHash": "0x..."
}
```

### Get Bridge Transactions

```
GET /token-scanner/bridge/transactions/:walletAddress
```

Get all bridge transactions for a wallet address.

**Parameters:**

- `walletAddress` (path): The Ethereum wallet address

**Response:**

```json
[
  {
    "transactionHash": "0x...",
    "usdcObtained": "99.5",
    "gasCost": "0.01",
    "timestamp": 1621234567,
    "bridgeProvider": "Wormhole",
    "estimatedArrivalTime": 1621236367,
    "destinationTxHash": "sui-tx-hash", // Only present if bridge is completed
    "status": "COMPLETED"
  }
]
```

### Bridge Webhook (Internal Use)

```
POST /token-scanner/bridge/webhook
```

Webhook endpoint for bridge providers to notify about status changes.

**Request Body:**

```json
{
  "transactionHash": "0x...",
  "status": "completed", // completed, failed, or pending
  "destinationTxHash": "sui-tx-hash" // Optional, only for completed bridges
}
```

**Response:**

```json
{
  "success": true
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Invalid wallet address",
  "error": "Bad Request"
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Failed to execute bridge: Error message",
  "error": "Internal Server Error"
}
```
