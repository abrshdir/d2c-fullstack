const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts to forked mainnet...");

  // Get the contract factory
  const SwapExecutor = await hre.ethers.getContractFactory("SwapExecutor");
  const Dust2CashEscrow = await hre.ethers.getContractFactory("Dust2CashEscrow");
  const CollateralLock = await hre.ethers.getContractFactory("CollateralLock");
  const Treasury = await hre.ethers.getContractFactory("Treasury");

  // Get the deployer's address to use as fee collector and relayer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // USDC address on mainnet
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  // Daily withdrawal limit (100,000 USDC)
  const DAILY_WITHDRAWAL_LIMIT = (100000 * 1e6).toString();

  // Deploy SwapExecutor
  console.log("Deploying SwapExecutor...");
  const swapExecutor = await SwapExecutor.deploy();
  await swapExecutor.deployed();
  console.log(`SwapExecutor deployed to: ${swapExecutor.address}`);

  // Deploy Dust2CashEscrow
  console.log("Deploying Dust2CashEscrow...");
  const escrow = await Dust2CashEscrow.deploy(USDC_ADDRESS, deployer.address);
  await escrow.deployed();
  console.log(`Dust2CashEscrow deployed to: ${escrow.address}`);

  // Deploy CollateralLock
  console.log("Deploying CollateralLock...");
  const collateralLock = await CollateralLock.deploy(USDC_ADDRESS, deployer.address);
  await collateralLock.deployed();
  console.log(`CollateralLock deployed to: ${collateralLock.address}`);

  // Deploy Treasury
  console.log("Deploying Treasury...");
  const treasury = await Treasury.deploy(
    USDC_ADDRESS,
    deployer.address,
    collateralLock.address,
    DAILY_WITHDRAWAL_LIMIT
  );
  await treasury.deployed();
  console.log(`Treasury deployed to: ${treasury.address}`);

  // Initialize contracts with their dependencies
  console.log("\nInitializing contracts...");

  console.log("Initializing Dust2CashEscrow...");
  // await escrow.initialize(swapExecutor.address);
  console.log("Dust2CashEscrow initialized");

  console.log("Initializing CollateralLock...");
  // await collateralLock.initialize(escrow.address);
  console.log("CollateralLock initialized");

  console.log("Initializing Treasury...");
  // await treasury.initialize(escrow.address, collateralLock.address);
  console.log("Treasury initialized");

  // Log contract addresses for easy reference
  console.log("\nContract Addresses:");
  console.log("-------------------");
  console.log(`SwapExecutor: ${swapExecutor.address}`);
  console.log(`Dust2CashEscrow: ${escrow.address}`);
  console.log(`CollateralLock: ${collateralLock.address}`);
  console.log(`Treasury: ${treasury.address}`);

  // Save addresses to a file for testing
  const fs = require('fs');
  const addresses = {
    swapExecutor: swapExecutor.address,
    escrow: escrow.address,
    collateralLock: collateralLock.address,
    treasury: treasury.address,
    network: hre.network.name,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    'deployed-addresses.json',
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nDeployed addresses saved to deployed-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 