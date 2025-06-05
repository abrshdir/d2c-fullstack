const hre = require("hardhat");

async function main() {
  // Get the contract factory
  const SwapExecutor = await hre.ethers.getContractFactory("SwapExecutor");
  
  console.log("Deploying SwapExecutor...");
  const swapExecutor = await SwapExecutor.deploy();
  
  // Wait for deployment to finish
  await swapExecutor.deployed();
  
  console.log(`SwapExecutor deployed to: ${swapExecutor.address}`);
  console.log("Note: You'll need to set the router address after deployment using the updateRouter function");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 