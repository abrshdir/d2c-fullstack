# Sui Move Contracts for Cross-Chain Staking

This directory contains the Sui Move contracts for the cross-chain staking protocol. These contracts handle the staking operations on the Sui blockchain, including receiving bridged assets, staking with validators, and managing rewards.

## Contract Structure

- `StakeModule`: Main contract for handling staking operations
- `BridgeReceiver`: Contract for receiving bridged assets from Wormhole
- `RewardDistributor`: Contract for managing and distributing staking rewards

## Building and Testing

```bash
# Build the contracts
sui move build

# Test the contracts
sui move test

# Publish the contracts
sui client publish --gas-budget 100000000
```

## Integration with Wormhole

These contracts integrate with Wormhole's token bridge to receive assets from Ethereum and send rewards back. The integration uses Wormhole's VAA (Verifiable Action Approval) system to verify cross-chain messages.
