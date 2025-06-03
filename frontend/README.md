# D2C Full Stack Application

This is a NextJS application that interacts with various DeFi protocols, including 1inch for token swaps and gas price information.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
ONEINCH_API_KEY=your_1inch_api_key
```

## API Endpoints

The application includes the following API endpoints:

### Gas Price

```
GET /api/gas-price
```

Returns current gas prices from 1inch API for Ethereum mainnet (chainId: 1).

**Response:**
```json
{
  "baseFee": "20000000000",
  "maxFeePerGas": "50000000000",
  "maxPriorityFeePerGas": "2000000000"
}
```

## Frontend Services

### OneInchService

The `oneInchService` provides methods to interact with 1inch protocol and our backend APIs:

- `getGasPrice()`: Fetches current gas prices from our backend API
- `getSupportedChains()`: Returns supported blockchain networks
- `getTokens(chainId)`: Returns tokens available on the specified chain
- `getQuote(chainId, fromTokenAddress, toTokenAddress, amount)`: Gets quote for token swap
- `getApproveTransaction(chainId, tokenAddress, amount)`: Gets approval transaction data
- `getSwap(chainId, fromTokenAddress, toTokenAddress, amount, fromAddress, slippage)`: Gets swap transaction data
- `calculateGasCost(gasEstimate, gasPrice)`: Calculates gas cost for a transaction
