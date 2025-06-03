# **App Name**: Gasless On-Ramp

## Core Features:

- Token Scan: Scan the user's wallet for ERC-20 tokens and display the top three tokens by USD value, excluding native tokens below 0.01 units. Values must be between $5 and $25.
- Gasless Permit: Prompt the user to sign an EIP-2612 permit for the selected token amount, enabling gasless transactions.
- Data Validation Tool: Uses a LLM as a tool to assess if token amount is correctly formatted
- Display Tokens: Show top 3 tokens to the user
- Off-Chain Relayer Swap: Swap the token to USDC on the same chain via Rubic SDK, relayer broadcasts the transaction and records the exact USDC received and gas cost to establish the user's 'loan owed'.
- Meta-Tx to Lock Collateral: Send a meta-transaction to the CollateralLock contract's lockCollateral function, pulling USDC from the relayer and recording loan details.
- Immediate USDC Withdrawal: Implement a withdraw function that allows users to withdraw collateral minus loan owed.
- Stake on SUI With Fee Discount: Implement a stakeOnSui function to opt into SUI staking, emitting an event for the relayer to bridge USDC to SUI and stake it, adjusting the user's loanOwed with a discount.
- Finalize Rewards & Release: Implement a finalizeRewards function that claims staking rewards, repays the discounted loanOwed, transfers surplus tokens to the user, and resets the contract state.
- Monitoring & Dashboard: Build a dashboard and webhook system that logs every step, displays user data, and alerts on failures.

## Style Guidelines:

- Primary color: Soft blue (#64B5F6), evoking trust and security.
- Background color: Light gray (#F0F4F8), providing a clean, neutral backdrop.
- Accent color: Teal (#4DB6AC), drawing attention to key actions and information.
- Clean, sans-serif fonts to ensure readability.
- Simple, geometric icons to represent tokens and actions.
- Clean and intuitive layouts with clear calls to action.
- Subtle transitions and loading animations to improve user experience.