const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  // Get the network name
  const network = hre.network.name;
  console.log(`Deploying Treasury to ${network}...`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  // Set USDC address based on network
  let usdcAddress;
  if (network === "mainnet") {
    usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Ethereum Mainnet USDC
  } else if (network === "polygon") {
    usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
  } else if (network === "arbitrum") {
    usdcAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"; // Arbitrum USDC
  } else if (network === "optimism") {
    usdcAddress = "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"; // Optimism USDC
  } else if (network === "base") {
    usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  } else {
    throw new Error(`Unsupported network: ${network}. Please deploy to a supported network.`);
  }

  // Set relayer address
  let relayerAddress;
  if (process.env.RELAYER_ADDRESS) {
    relayerAddress = process.env.RELAYER_ADDRESS;
  } else {
    throw new Error("RELAYER_ADDRESS environment variable is required");
  }

  // Set collateral lock address
  let collateralLockAddress;
  if (process.env.COLLATERAL_LOCK_ADDRESS) {
    collateralLockAddress = process.env.COLLATERAL_LOCK_ADDRESS;
  } else {
    // Deploy a new CollateralLock contract if not provided
    console.log("Deploying CollateralLock contract...");
    const CollateralLock = await ethers.getContractFactory("CollateralLock");
    const collateralLock = await CollateralLock.deploy(
      usdcAddress,
      relayerAddress
    );
    await collateralLock.deployed();
    collateralLockAddress = collateralLock.address;
    console.log(`CollateralLock deployed to: ${collateralLockAddress}`);
  }

  // Set daily withdrawal limit (default: 10,000 USDC)
  const dailyWithdrawalLimit = process.env.DAILY_WITHDRAWAL_LIMIT
    ? ethers.utils.parseUnits(process.env.DAILY_WITHDRAWAL_LIMIT, 6)
    : ethers.utils.parseUnits("10000", 6);

  // Deploy Treasury contract
  console.log("Deploying Treasury contract...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(
    usdcAddress,
    relayerAddress,
    collateralLockAddress,
    dailyWithdrawalLimit
  );

  await treasury.deployed();
  console.log(`Treasury deployed to: ${treasury.address}`);

  // Wait for block confirmations for verification
  console.log("Waiting for block confirmations...");
  await treasury.deployTransaction.wait(5); // Wait for 5 confirmations

  // Verify contract on block explorer
  console.log("Verifying contract on block explorer...");
  try {
    await hre.run("verify:verify", {
      address: treasury.address,
      constructorArguments: [
        usdcAddress,
        relayerAddress,
        collateralLockAddress,
        dailyWithdrawalLimit,
      ],
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }

  console.log("Deployment completed successfully");
  console.log({
    treasury: treasury.address,
    usdc: usdcAddress,
    relayer: relayerAddress,
    collateralLock: collateralLockAddress,
    dailyWithdrawalLimit: ethers.utils.formatUnits(dailyWithdrawalLimit, 6),
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
