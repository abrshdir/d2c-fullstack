const hre = require("hardhat");

async function main() {
  // Start the forked node
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: "https://eth-mainnet.g.alchemy.com/v2/WpG6wxf_QCvIhZQUA3hAFzKJcMs7FMzJ",
          blockNumber: 19000000,
        },
      },
    ],
  });

  console.log("Forked mainnet node started successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 