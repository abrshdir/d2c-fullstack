# Stranded Value Scanner

A NestJS backend service that scans Ethereum and Polygon chains for non-zero ERC-20 token balances in a wallet address. It identifies "stranded value" in wallets that are unusable due to gas shortages (insufficient ETH or MATIC for transaction fees).

## Features

- Scans wallet addresses for ERC-20 token balances on Ethereum and Polygon chains
- Filters out wallets that have sufficient ETH (≥ 0.01) or MATIC (≥ 0.01) for gas
- Enriches token data with real-time USD values using CoinGecko API
- Returns the top 3 highest-value tokens in the wallet
- Identifies wallets with "stranded value" (valuable tokens that can't be moved due to insufficient gas)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Alchemy API keys for Ethereum and Polygon networks
- CoinGecko API key (optional, but recommended to avoid rate limits)

## Project Setup

```bash
$ npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
# Alchemy API Keys
ALCHEMY_ETHEREUM_API_KEY=your_ethereum_api_key_here
ALCHEMY_POLYGON_API_KEY=your_polygon_api_key_here

# CoinGecko API Key
COINGECKO_API_KEY=your_coingecko_api_key_here
```

## Running the Application

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## API Endpoints

### Scan Wallet for Tokens

```
GET /token-scanner/scan?walletAddress=0x...
```

**Query Parameters:**

- `walletAddress`: Ethereum wallet address to scan (required)

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
    // Up to 3 tokens sorted by USD value
  ],
  "hasStrandedValue": true
}
```

## Run Tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
