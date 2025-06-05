// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");

async function main() {
  console.log("Deploying CollateralLock contract...");

  // Sepolia USDC address
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  // Get the deployer's address to use as relayer
  const [deployer] = await hre.ethers.getSigners();
  const relayer = deployer.address;

  console.log("Deploying with the following parameters:");
  console.log("USDC Address:", usdcAddress);
  console.log("Relayer:", relayer);

  // Deploy the CollateralLock contract
  const CollateralLock = await hre.ethers.getContractFactory("CollateralLock");
  const collateralLock = await CollateralLock.deploy(usdcAddress, relayer);
  await collateralLock.deployed();

  console.log("CollateralLock deployed to:", collateralLock.address);
  console.log("\nVerify with:");
  console.log(`npx hardhat verify --network sepolia ${collateralLock.address} ${usdcAddress} ${relayer}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
