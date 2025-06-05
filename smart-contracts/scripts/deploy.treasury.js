const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Treasury contract...");

  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with address:", deployer.address);

  // Sepolia USDC address
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  // Set relayer address (using deployer for now)
  const relayerAddress = deployer.address;
  
  // Get the deployed CollateralLock address
  //COLLATERAL_LOCK_CONTRACT_ADDRESS=0x73447103D175D348ef1501215398f69697abE1f7
  const collateralLockAddress = '0x73447103D175D348ef1501215398f69697abE1f7';
  if (!collateralLockAddress) {
    throw new Error("COLLATERAL_LOCK_ADDRESS environment variable is required");
  }

  // Set daily withdrawal limit (10,000 USDC)
  const dailyWithdrawalLimit = ethers.utils.parseUnits("10000", 6);

  // Deploy Treasury contract
  const Treasury = await hre.ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(
    usdcAddress,
    relayerAddress,
    collateralLockAddress,
    dailyWithdrawalLimit
  );

  await treasury.deployed();
  const treasuryAddress = treasury.address;

  console.log("Treasury deployed to:", '0x4E7044CD22475E7833951D1C98c9C8f3fC88B055');
  console.log("\nVerification command:");
  console.log(`npx hardhat verify --network sepolia ${treasuryAddress} "${usdcAddress}" "${relayerAddress}" "${collateralLockAddress}" "${dailyWithdrawalLimit}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
