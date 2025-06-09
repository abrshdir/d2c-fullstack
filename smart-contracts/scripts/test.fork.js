const hre = require("hardhat");
const fs = require('fs');

async function main() {
  // Load deployed addresses
  const addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
  
  // Get signers
  const [deployer, user] = await hre.ethers.getSigners();
  console.log("Testing with accounts:", {
    deployer: deployer.address,
    user: user.address,
  });

  // Get contract instances
  const swapExecutor = await hre.ethers.getContractAt("SwapExecutor", addresses.swapExecutor);
  const escrow = await hre.ethers.getContractAt("Escrow", addresses.escrow);
  const collateralLock = await hre.ethers.getContractAt("CollateralLock", addresses.collateralLock);
  const treasury = await hre.ethers.getContractAt("Treasury", addresses.treasury);

  // Test token addresses (using real mainnet addresses)
  const USDC = "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

  // Get some test tokens for the user
  console.log("Getting test tokens...");
  
  // Impersonate a whale account that has USDC
  const whaleAddress = "0x55FE002aefF02F77364de339a1292923A15844B8"; // USDC whale
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress],
  });
  
  const whale = await hre.ethers.getSigner(whaleAddress);
  const usdcContract = await hre.ethers.getContractAt("IERC20", USDC);
  
  // Transfer some USDC to our test user
  await usdcContract.connect(whale).transfer(user.address, hre.ethers.parseUnits("1000", 6));
  console.log("Transferred 1000 USDC to test user");

  // Test permit signing
  console.log("\nTesting permit signing...");
  const permitAmount = hre.ethers.parseUnits("100", 6);
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  const domain = {
    name: "USD Coin",
    version: "1",
    chainId: 1,
    verifyingContract: USDC,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const nonce = await usdcContract.nonces(user.address);
  
  const permitData = {
    owner: user.address,
    spender: await escrow.getAddress(),
    value: permitAmount,
    nonce: nonce,
    deadline: deadline,
  };

  const signature = await user.signTypedData(domain, types, permitData);
  console.log("Permit signature generated");

  // Test swap execution
  console.log("\nTesting swap execution...");
  const swapTx = await swapExecutor.connect(user).executeSwap(
    USDC,
    WETH,
    permitAmount,
    deadline,
    signature
  );
  await swapTx.wait();
  console.log("Swap executed successfully");

  // Check balances
  const wethContract = await hre.ethers.getContractAt("IERC20", WETH);
  const userWethBalance = await wethContract.balanceOf(user.address);
  console.log("User WETH balance:", hre.ethers.formatEther(userWethBalance));

  // Test escrow functionality
  console.log("\nTesting escrow functionality...");
  const escrowBalance = await usdcContract.balanceOf(await escrow.getAddress());
  console.log("Escrow USDC balance:", hre.ethers.formatUnits(escrowBalance, 6));

  // Test collateral lock
  console.log("\nTesting collateral lock...");
  const lockTx = await collateralLock.connect(user).lockCollateral(
    USDC,
    permitAmount
  );
  await lockTx.wait();
  console.log("Collateral locked successfully");

  // Test treasury
  console.log("\nTesting treasury...");
  const treasuryBalance = await usdcContract.balanceOf(await treasury.getAddress());
  console.log("Treasury USDC balance:", hre.ethers.formatUnits(treasuryBalance, 6));

  console.log("\nAll tests completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 