const hre = require("hardhat");

async function main() {
  console.log("Deploying Dust2CashEscrow contract...");

  // Get network-specific USDC address
  let usdcAddress;
  let networkName = hre.network.name;

  if (networkName === "ethereum" || networkName === "mainnet") {
    // Ethereum Mainnet USDC address
    usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    networkName = "Ethereum Mainnet";
  } else if (networkName === "polygon") {
    // Polygon Mainnet USDC address
    usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    networkName = "Polygon Mainnet";
  } else if (networkName === "hardhat" || networkName === "localhost") {
    // For local testing, deploy a mock USDC token
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();
    usdcAddress = mockUSDC.address;
    console.log(`Mock USDC deployed to: ${usdcAddress}`);
    networkName = "Local Network";
  } else {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  // Get the deployer's address to use as fee collector initially
  const [deployer] = await hre.ethers.getSigners();
  const feeCollector = deployer.address;

  // Deploy the Dust2CashEscrow contract
  const Dust2CashEscrow = await hre.ethers.getContractFactory(
    "Dust2CashEscrow"
  );
  const escrow = await Dust2CashEscrow.deploy(usdcAddress, feeCollector);
  await escrow.deployed();

  console.log(
    `Dust2CashEscrow deployed to: ${escrow.address} on ${networkName}`
  );
  console.log(`USDC Address: ${usdcAddress}`);
  console.log(`Fee Collector: ${feeCollector}`);
  console.log("\nVerify with:");
  console.log(
    `npx hardhat verify --network ${hre.network.name} ${escrow.address} ${usdcAddress} ${feeCollector}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
