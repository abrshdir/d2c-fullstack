const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  // Get the network name
  const network = hre.network.name;
  console.log(`Deploying Treasury to ${network}...`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  // Use existing MockUSDC address
  const usdcAddress = "0x4D04D5E2d531CbEd238Ef0f794CdbE767C83C33E";
  console.log(`Using existing MockUSDC at: ${usdcAddress}`);

  // Use existing CollateralLock address
  const collateralLockAddress = "0x7fffBC1fc84F816353684EAc12E9a3344FFEAD29";
  console.log(`Using existing CollateralLock at: ${collateralLockAddress}`);

  // Set relayer address
  let relayerAddress;
  if (process.env.RELAYER_ADDRESS) {
    relayerAddress = process.env.RELAYER_ADDRESS;
  } else {
    // Use deployer as relayer for testing
    relayerAddress = deployer.address;
    console.log("Using deployer as relayer for testing");
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

  // Verify contract on block explorer if not on local network
  if (network !== "hardhat" && network !== "localhost") {
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