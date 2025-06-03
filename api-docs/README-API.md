# Cross-Chain SUI Staking API Documentation

This document provides an overview of the API implementation for the Cross-Chain SUI Staking system.

## API Overview

The API is designed to handle cross-chain staking operations between Ethereum and Sui networks. It provides endpoints for:

1. Processing gas loans and swaps
2. Managing staking positions
3. Handling withdrawals
4. Tracking transaction history

## Authentication

All API endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Gas Loan Processing

#### POST /api/v1/gas-loan/process-swap

Initiates a gas loan swap operation. This endpoint handles:
- ERC-2612 permit verification
- Token swap via Rubic
- Gas cost estimation
- Transaction status tracking

**Request Body:**
```json
{
  "amount": "1000000000000000000",
  "tokenAddress": "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "permit": {
    "owner": "0x...",
    "spender": "0x...",
    "value": "1000000000000000000",
    "deadline": "1234567890",
    "v": "27",
    "r": "0x...",
    "s": "0x..."
  }
}
```

### Staking Status

#### GET /api/v1/staking/status/{loanId}

Retrieves the current status of a staking position.

**Response:**
```json
{
  "loanId": "123",
  "status": "STAKED",
  "stakedAmount": "1000000000000000000",
  "rewardsAccrued": "100000000000000000",
  "lastUpdateTimestamp": "1234567890"
}
```

### Withdrawal

#### POST /api/v1/staking/withdraw

Initiates a withdrawal from a staking position.

**Request Body:**
```json
{
  "loanId": "123"
}
```

### Transaction History

#### GET /api/v1/transactions/history

Retrieves the transaction history for the authenticated user.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

## Error Handling

All endpoints return standardized error responses:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {
    // Additional error details if available
  }
}
```

## State Management

The API uses a PostgreSQL database to maintain state. Key tables include:

1. `loans`: Tracks loan positions and their status
2. `transactions`: Records all blockchain transactions
3. `staking_positions`: Manages staking positions on Sui
4. `rewards`: Tracks accrued rewards

## Security Considerations

1. All endpoints require authentication
2. Rate limiting is implemented to prevent abuse
3. Input validation is performed on all requests
4. Sensitive operations require additional verification
5. All blockchain interactions are signed by a secure key management system

## Monitoring

The API integrates with monitoring tools to track:
- Request latency
- Error rates
- Transaction success rates
- Gas costs
- Bridge operation status

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Access the API documentation:
   ```
   http://localhost:3000/api-docs
   ```

## Testing

Run the test suite:
```bash
npm test
```

## Deployment

The API is containerized and can be deployed using Docker:

```bash
docker build -t sui-staking-api .
docker run -p 3000:3000 sui-staking-api
``` 