const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Dust2CashEscrow Integration Tests", function () {
  async function deployContracts() {
    const [owner, feeCollector, user1, user2, user3] =
      await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    const Dust2CashEscrow = await ethers.getContractFactory("Dust2CashEscrow");
    const dust2CashEscrow = await Dust2CashEscrow.deploy(
      mockUSDC.address,
      feeCollector.address
    );
    await dust2CashEscrow.deployed();

    // Mint USDC to owner for testing
    const initialMint = ethers.utils.parseUnits("1000000", 6); // 1M USDC
    await mockUSDC.mint(owner.address, initialMint);
    await mockUSDC.approve(dust2CashEscrow.address, initialMint);

    return {
      dust2CashEscrow,
      mockUSDC,
      owner,
      feeCollector,
      user1,
      user2,
      user3,
    };
  }

  describe("Complete User Journey", function () {
    it("Should handle a complete user journey with multiple deposits and repayments", async function () {
      const { dust2CashEscrow, mockUSDC, owner, feeCollector, user1 } =
        await loadFixture(deployContracts);

      // First deposit
      const deposit1 = ethers.utils.parseUnits("1000", 6);
      const gasDebt1 = deposit1.div(10);
      await dust2CashEscrow.depositForUser(user1.address, deposit1, gasDebt1);

      // Check initial state
      let userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.escrowedAmount).to.equal(deposit1);
      expect(userAccount.outstandingDebt).to.equal(gasDebt1);
      expect(userAccount.reputationScore).to.equal(70);

      // Repay first gas debt
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt1);

      // Check state after repayment
      userAccount = await dust2CashEscrow.getUserAccountStatus(user1.address);
      expect(userAccount.outstandingDebt).to.equal(0);
      // When repaying, the contract reduces the escrowed amount by the repayment amount
      expect(userAccount.escrowedAmount).to.equal(deposit1.sub(gasDebt1));
      expect(userAccount.reputationScore).to.equal(75); // Increased by 5

      // Second deposit
      const deposit2 = ethers.utils.parseUnits("2000", 6);
      const gasDebt2 = deposit2.div(10);
      await dust2CashEscrow.depositForUser(user1.address, deposit2, gasDebt2);

      // Check state after second deposit
      userAccount = await dust2CashEscrow.getUserAccountStatus(user1.address);
      // After second deposit, escrowed amount should be deposit2 (2000 USDC)
      // The contract replaces the previous escrowed amount rather than adding to it
      expect(userAccount.escrowedAmount).to.equal(deposit2);
      expect(userAccount.outstandingDebt).to.equal(gasDebt2);

      // Repay second gas debt before withdrawal
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt2);

      // Verify debt is cleared
      userAccount = await dust2CashEscrow.getUserAccountStatus(user1.address);
      expect(userAccount.outstandingDebt).to.equal(0);

      // Withdraw funds
      await dust2CashEscrow.connect(user1).withdrawFunds();

      // Check final state
      userAccount = await dust2CashEscrow.getUserAccountStatus(user1.address);
      expect(userAccount.escrowedAmount).to.equal(0);
      expect(userAccount.outstandingDebt).to.equal(0);

      // Check fee collector received fees
      const feeCollectorBalance = await mockUSDC.balanceOf(
        feeCollector.address
      );
      
      // Calculate expected fee collector balance:
      // First gas debt (100 USDC) + Second gas debt (200 USDC) + 
      // Service fee (2% of remaining 1800 USDC from deposit2 = 36 USDC)
      const expectedFeeCollectorBalance = gasDebt1.add(gasDebt2).add(deposit2.sub(gasDebt2).mul(200).div(10000));
      expect(feeCollectorBalance).to.equal(expectedFeeCollectorBalance);
    });
  });

  describe("Multiple Users Interaction", function () {
    it("Should handle multiple users depositing and repaying", async function () {
      const {
        dust2CashEscrow,
        mockUSDC,
        owner,
        feeCollector,
        user1,
        user2,
        user3,
      } = await loadFixture(deployContracts);

      // Deposit for multiple users
      const depositAmount = ethers.utils.parseUnits("1000", 6);
      const gasDebt = depositAmount.div(10);

      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );
      await dust2CashEscrow.depositForUser(
        user2.address,
        depositAmount,
        gasDebt
      );
      await dust2CashEscrow.depositForUser(
        user3.address,
        depositAmount,
        gasDebt
      );

      // Check total escrowed amount
      // The contract adds to the totalEscrowed global counter for each deposit
      expect(await dust2CashEscrow.totalEscrowed()).to.equal(
        depositAmount.mul(3)
      );
      expect(await dust2CashEscrow.totalOutstandingDebt()).to.equal(
        gasDebt.mul(3)
      );

      // User1 repays
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt);

      // User2 misses repayment twice to get blacklisted
      await dust2CashEscrow.markMissedRepayment(user2.address);
      await dust2CashEscrow.markMissedRepayment(user2.address);

      // User3 repays
      await dust2CashEscrow.connect(user3).repayGasLoan(gasDebt);

      // Check reputation scores
      const user1Account = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      const user2Account = await dust2CashEscrow.getUserAccountStatus(
        user2.address
      );
      const user3Account = await dust2CashEscrow.getUserAccountStatus(
        user3.address
      );

      expect(user1Account.reputationScore).to.equal(75); // Increased
      expect(user2Account.reputationScore).to.equal(30); // Decreased twice (70 - 20 - 20)
      expect(user3Account.reputationScore).to.equal(75); // Increased

      // Check blacklist status
      expect(user2Account.isBlacklisted).to.be.true;
    });
  });

  describe("Contract Pause and Unpause", function () {
    it("Should handle contract pause and unpause correctly", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      const depositAmount = ethers.utils.parseUnits("1000", 6);
      const gasDebt = depositAmount.div(10);

      // Initial deposit
      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );

      // Pause contract
      await dust2CashEscrow.pause();

      // Try to repay while paused
      await expect(
        dust2CashEscrow.connect(user1).repayGasLoan(gasDebt)
      ).to.be.revertedWith("Pausable: paused");

      // Try to withdraw while paused
      await expect(
        dust2CashEscrow.connect(user1).withdrawFunds()
      ).to.be.revertedWith("Pausable: paused");

      // Unpause contract
      await dust2CashEscrow.unpause();

      // Should work after unpause
      await expect(dust2CashEscrow.connect(user1).repayGasLoan(gasDebt)).to.not
        .be.reverted;
    });
  });

  describe("Timelock and Admin Changes", function () {
    it("Should handle timelock for admin changes correctly", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      // Set pending fee collector
      await dust2CashEscrow.setPendingFeeCollector(user1.address);

      // Try to confirm before timelock
      await expect(dust2CashEscrow.confirmFeeCollector()).to.be.revertedWith(
        "Timelock not expired"
      );

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days
      await ethers.provider.send("evm_mine");

      // Should work after timelock
      await expect(dust2CashEscrow.confirmFeeCollector()).to.not.be.reverted;

      // Check new fee collector
      expect(await dust2CashEscrow.feeCollector()).to.equal(user1.address);
    });
  });

  describe("Emergency Scenarios", function () {
    it("Should handle emergency scenarios correctly", async function () {
      const { dust2CashEscrow, mockUSDC, owner, user1 } = await loadFixture(
        deployContracts
      );

      // Deploy a test token
      const TestToken = await ethers.getContractFactory("TestToken");
      const testToken = await TestToken.deploy();
      await testToken.deployed();

      // Send test tokens to escrow
      const amount = ethers.utils.parseUnits("100", 6);
      await testToken.mint(owner.address, amount);
      await testToken.transfer(dust2CashEscrow.address, amount);

      // Recover test tokens
      await dust2CashEscrow.recoverERC20(testToken.address, amount);
      expect(await testToken.balanceOf(owner.address)).to.equal(amount);

      // Try to recover USDC (should fail)
      const depositAmount = ethers.utils.parseUnits("1000", 6);
      const gasDebt = depositAmount.div(10);
      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );

      await expect(
        dust2CashEscrow.recoverERC20(mockUSDC.address, depositAmount)
      ).to.be.revertedWith("Cannot recover escrowed USDC");
    });
  });
});
