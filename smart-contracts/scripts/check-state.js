const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking local fork state...\n");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("👤 Your address:", signer.address);
    
    // Check relayer balance
    const relayerAddress = "0xDec80E988F4baF43be69c13711453013c212feA8"; // Protoclink swap contract
    const relayerBalance = await ethers.provider.getBalance(relayerAddress);
    console.log("\n💰 Relayer ETH Balance:", ethers.utils.formatEther(relayerBalance), "ETH");

    // Get the escrow contract
    console.log("\n📊 Checking Escrow Contract...");
    const escrowAddress = "0x0B32a3F8f5b7E5d315b9E52E640a49A89d89c820";
    console.log("Escrow address:", escrowAddress);

    // Get USDC contract
    const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const usdc = await ethers.getContractAt("IERC20", usdcAddress);
    const usdcBalance = await usdc.balanceOf(escrowAddress);
    console.log("USDC Balance in Escrow:", ethers.utils.formatUnits(usdcBalance, 6));

    // Get the swap executor contract
    console.log("\n🔄 Checking Swap Executor...");
    const swapExecutorAddress = "0x15F2ea83eB97ede71d84Bd04fFF29444f6b7cd52";
    console.log("Swap Executor address:", swapExecutorAddress);

    // Get the collateral lock contract
    console.log("\n🔒 Checking Collateral Lock...");
    const collateralLockAddress = "0xF357118EBd576f3C812c7875B1A1651a7f140E9C";
    console.log("Collateral Lock address:", collateralLockAddress);

    // Get the treasury contract
    console.log("\n💰 Checking Treasury...");
    const treasuryAddress = "0x519b05b3655F4b89731B677d64CEcf761f4076f6";
    console.log("Treasury address:", treasuryAddress);

    // Check recent transactions
    console.log("\n📝 Recent Transactions:");
    const latestBlock = await ethers.provider.getBlockNumber();
    console.log("Latest block:", latestBlock);

    // Get transactions in the last 5 blocks
    for(let i = 0; i < 5; i++) {
        const block = await ethers.provider.getBlock(latestBlock - i);
        console.log(`\nBlock ${block.number}:`);
        console.log("Timestamp:", new Date(block.timestamp * 1000).toLocaleString());
        console.log("Transactions:", block.transactions.length);
        
        // Get transaction details for each tx in the block
        for(const txHash of block.transactions) {
            const tx = await ethers.provider.getTransaction(txHash);
            const receipt = await ethers.provider.getTransactionReceipt(txHash);
            console.log(`\nTransaction: ${txHash}`);
            console.log("From:", tx.from);
            console.log("To:", tx.to);
            console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
            console.log("Gas Used:", receipt.gasUsed.toString());
            console.log("Gas Price:", ethers.utils.formatUnits(tx.gasPrice, "gwei"), "gwei");
            console.log("Total Cost:", ethers.utils.formatEther(tx.gasPrice.mul(receipt.gasUsed)), "ETH");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 