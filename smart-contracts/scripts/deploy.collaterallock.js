// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get network name
  const networkName = hre.network.name;
  console.log("Network:", networkName);

  // Deploy MockUSDC for testing networks
  let usdcAddress;
  if (networkName === "hardhat" || networkName === "localhost") {
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();
    usdcAddress = mockUSDC.address;
    console.log("MockUSDC deployed to:", usdcAddress);
  } else {
    // Use real USDC addresses for mainnet networks
    if (networkName === "ethereum") {
      usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Ethereum Mainnet USDC
    } else if (networkName === "polygon") {
      usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon Mainnet USDC
    } else if (networkName === "sepolia") {
      usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia Testnet USDC
    } else {
      throw new Error(
        `USDC address not configured for network: ${networkName}`
      );
    }
    console.log("Using USDC at:", usdcAddress);
  }

  // Get relayer address from environment or use deployer as default
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  console.log("Using relayer address:", relayerAddress);

  // Deploy CollateralLock
  const CollateralLock = await hre.ethers.getContractFactory("CollateralLock");
  const collateralLock = await CollateralLock.deploy(
    usdcAddress,
    relayerAddress
  );
  await collateralLock.deployed();

  console.log("CollateralLock deployed to:", collateralLock.address);

  // Wait for a few block confirmations to make verification easier
  console.log("Waiting for block confirmations...");
  await collateralLock.deployTransaction.wait(5);

  // Verify contract on Etherscan/Polygonscan if not on a local network
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("Verifying contract on explorer...");
    try {
      await hre.run("verify:verify", {
        address: collateralLock.address,
        constructorArguments: [usdcAddress, relayerAddress],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Error verifying contract:", error);
    }
  }

  return {
    collateralLock: collateralLock.address,
    usdc: usdcAddress,
    relayer: relayerAddress,
  };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((deployedContracts) => {
    console.log("Deployment completed successfully!");
    console.log(JSON.stringify(deployedContracts, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
