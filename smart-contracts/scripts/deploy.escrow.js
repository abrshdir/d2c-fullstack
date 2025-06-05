const hre = require("hardhat");

async function main() {
  console.log("Deploying Dust2CashEscrow contract...");

  // Sepolia USDC address
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  // Get the deployer's address to use as fee collector
  const [deployer] = await hre.ethers.getSigners();
  const feeCollector = deployer.address;

  console.log("Deploying with the following parameters:");
  console.log("USDC Address:", usdcAddress);
  console.log("Fee Collector:", feeCollector);

  // Deploy the Dust2CashEscrow contract
  const Dust2CashEscrow = await hre.ethers.getContractFactory("Dust2CashEscrow");
  const escrow = await Dust2CashEscrow.deploy(usdcAddress, feeCollector);
  await escrow.deployed();

  console.log("Dust2CashEscrow deployed to:", escrow.address);
  console.log("\nVerify with:");
  console.log(`npx hardhat verify --network sepolia ${escrow.address} ${usdcAddress} ${feeCollector}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 