const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Dust2CashEscrow", function () {
  let dust2CashEscrow;
  let mockUSDC;
  let owner;
  let feeCollector;
  let user1;
  let user2;

  const initialMint = ethers.utils.parseUnits("10000", 6); // 10,000 USDC
  const depositAmount = ethers.utils.parseUnits("1000", 6); // 1,000 USDC
  const gasDebt = ethers.utils.parseUnits("50", 6); // 50 USDC gas debt

  beforeEach(async function () {
    // Get signers
    [owner, feeCollector, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Deploy Dust2CashEscrow
    const Dust2CashEscrow = await ethers.getContractFactory("Dust2CashEscrow");
    dust2CashEscrow = await Dust2CashEscrow.deploy(
      mockUSDC.address,
      feeCollector.address
    );
    await dust2CashEscrow.deployed();

    // Mint USDC to owner for testing
    await mockUSDC.mint(owner.address, initialMint);

    // Approve escrow contract to spend owner's USDC
    await mockUSDC.approve(dust2CashEscrow.address, initialMint);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await dust2CashEscrow.owner()).to.equal(owner.address);
    });

    it("Should set the right USDC token", async function () {
      expect(await dust2CashEscrow.usdcToken()).to.equal(mockUSDC.address);
    });

    it("Should set the right fee collector", async function () {
      expect(await dust2CashEscrow.feeCollector()).to.equal(
        feeCollector.address
      );
    });
  });

  describe("Deposits", function () {
    it("Should deposit USDC and record gas debt", async function () {
      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.escrowedAmount).to.equal(depositAmount);
      expect(userAccount.outstandingDebt).to.equal(gasDebt);
      expect(userAccount.reputationScore).to.equal(70); // Default reputation
      expect(userAccount.isBlacklisted).to.equal(false);

      // Check contract balances
      expect(await mockUSDC.balanceOf(dust2CashEscrow.address)).to.equal(
        depositAmount
      );
      expect(await dust2CashEscrow.totalEscrowed()).to.equal(depositAmount);
      expect(await dust2CashEscrow.totalOutstandingDebt()).to.equal(gasDebt);
    });

    it("Should fail if gas debt exceeds deposit amount", async function () {
      const invalidGasDebt = depositAmount.mul(11).div(100); // 11% of deposit
      await expect(
        dust2CashEscrow.depositForUser(
          user1.address,
          depositAmount,
          invalidGasDebt
        )
      ).to.be.revertedWith("Gas debt too high");
    });

    it("Should fail if caller is not owner", async function () {
      await expect(
        dust2CashEscrow
          .connect(user1)
          .depositForUser(user1.address, depositAmount, gasDebt)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Gas Loan Repayment", function () {
    beforeEach(async function () {
      // Deposit for user1
      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );
    });

    it("Should allow user to repay gas loan", async function () {
      // User repays full gas debt
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt);

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.outstandingDebt).to.equal(0);
      expect(userAccount.escrowedAmount).to.equal(depositAmount.sub(gasDebt));

      // Check balances
      expect(await mockUSDC.balanceOf(dust2CashEscrow.address)).to.equal(
        depositAmount.sub(gasDebt)
      );
      expect(await mockUSDC.balanceOf(feeCollector.address)).to.equal(gasDebt);
      expect(await dust2CashEscrow.totalEscrowed()).to.equal(
        depositAmount.sub(gasDebt)
      );
      expect(await dust2CashEscrow.totalOutstandingDebt()).to.equal(0);

      // Check reputation increase
      expect(userAccount.reputationScore).to.be.gt(70); // Should be increased
    });

    it("Should allow partial repayment", async function () {
      const partialRepayment = gasDebt.div(2);
      await dust2CashEscrow.connect(user1).repayGasLoan(partialRepayment);

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.outstandingDebt).to.equal(
        gasDebt.sub(partialRepayment)
      );
      expect(userAccount.escrowedAmount).to.equal(
        depositAmount.sub(partialRepayment)
      );

      // No reputation increase for partial repayment
      expect(userAccount.reputationScore).to.equal(70);
    });

    it("Should fail if repayment amount exceeds debt", async function () {
      await expect(
        dust2CashEscrow.connect(user1).repayGasLoan(gasDebt.add(1))
      ).to.be.revertedWith("Invalid repayment amount");
    });
  });

  describe("Fund Withdrawal", function () {
    beforeEach(async function () {
      // Deposit for user1
      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );
      // User repays gas loan
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt);
    });

    it("Should allow withdrawal after gas loan repayment", async function () {
      const remainingAmount = depositAmount.sub(gasDebt);
      const serviceFee = remainingAmount.mul(200).div(10000); // 2% fee
      const expectedWithdrawal = remainingAmount.sub(serviceFee);

      await dust2CashEscrow.connect(user1).withdrawFunds();

      // Check user received funds
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(
        expectedWithdrawal
      );

      // Check fee collector received fee
      expect(await mockUSDC.balanceOf(feeCollector.address)).to.equal(
        gasDebt.add(serviceFee)
      );

      // Check escrow is empty
      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.escrowedAmount).to.equal(0);
      expect(await dust2CashEscrow.totalEscrowed()).to.equal(0);
    });

    it("Should fail withdrawal if debt not fully repaid", async function () {
      // Deposit for user2 but don't repay
      await dust2CashEscrow.depositForUser(
        user2.address,
        depositAmount,
        gasDebt
      );

      await expect(
        dust2CashEscrow.connect(user2).withdrawFunds()
      ).to.be.revertedWith("Outstanding debt must be repaid first");
    });
  });

  describe("Reputation Management", function () {
    beforeEach(async function () {
      // Deposit for users
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
    });

    it("Should increase reputation after successful repayment", async function () {
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt);

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.reputationScore).to.equal(75); // 70 + 5
    });

    it("Should decrease reputation for missed repayment", async function () {
      await dust2CashEscrow.markMissedRepayment(user2.address);

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user2.address
      );
      expect(userAccount.reputationScore).to.equal(50); // 70 - 20
    });

    it("Should blacklist user if reputation falls below threshold", async function () {
      // Mark missed repayment multiple times to drop below threshold
      await dust2CashEscrow.markMissedRepayment(user2.address);
      await dust2CashEscrow.markMissedRepayment(user2.address);

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user2.address
      );
      expect(userAccount.isBlacklisted).to.equal(true);

      // Blacklisted user cannot repay or withdraw
      await expect(
        dust2CashEscrow.connect(user2).repayGasLoan(gasDebt)
      ).to.be.revertedWith("User is blacklisted");
    });

    it("Should allow owner to manually set reputation", async function () {
      await dust2CashEscrow.setReputationScore(user1.address, 90);

      const userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.reputationScore).to.equal(90);
    });

    it("Should allow owner to remove user from blacklist", async function () {
      // Blacklist user
      await dust2CashEscrow.markMissedRepayment(user2.address);
      await dust2CashEscrow.markMissedRepayment(user2.address);

      // Verify blacklisted
      let userAccount = await dust2CashEscrow.getUserAccountStatus(
        user2.address
      );
      expect(userAccount.isBlacklisted).to.equal(true);

      // Remove from blacklist
      await dust2CashEscrow.removeFromBlacklist(user2.address);

      // Verify unblacklisted
      userAccount = await dust2CashEscrow.getUserAccountStatus(user2.address);
      expect(userAccount.isBlacklisted).to.equal(false);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update service fee rate", async function () {
      const newFeeRate = 500; // 5%
      await dust2CashEscrow.setPendingFeeRate(newFeeRate);
      
      // Fast forward time to bypass timelock
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days
      await ethers.provider.send("evm_mine");
      
      await dust2CashEscrow.confirmFeeRate();
      expect(await dust2CashEscrow.serviceFeeRate()).to.equal(newFeeRate);
    });

    it("Should not allow fee rate above 10%", async function () {
      const invalidFeeRate = 1100; // 11%
      await expect(
        dust2CashEscrow.setPendingFeeRate(invalidFeeRate)
      ).to.be.revertedWith("Fee cannot exceed 10%");
    });

    it("Should allow owner to update fee collector", async function () {
      await dust2CashEscrow.setPendingFeeCollector(user1.address);
      
      // Fast forward time to bypass timelock
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days
      await ethers.provider.send("evm_mine");
      
      await dust2CashEscrow.confirmFeeCollector();
      expect(await dust2CashEscrow.feeCollector()).to.equal(user1.address);
    });
  });

  describe("User Account Stats", function () {
    it("Should track user account statistics", async function () {
      // Deposit for user
      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );

      // Repay gas loan
      await dust2CashEscrow.connect(user1).repayGasLoan(gasDebt);

      // Withdraw funds
      await dust2CashEscrow.connect(user1).withdrawFunds();

      // Check stats
      const stats = await dust2CashEscrow.getUserAccountStats(user1.address);
      expect(stats.totalDeposited).to.equal(depositAmount);
      expect(stats.loansRepaid).to.equal(1);
      expect(stats.loansMissed).to.equal(0);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow recovery of non-USDC tokens", async function () {
      // Deploy a test token
      const TestToken = await ethers.getContractFactory("TestToken");
      const testToken = await TestToken.deploy();
      await testToken.deployed();

      // Mint specific amount to owner
      const amount = ethers.utils.parseUnits("100", 6);
      await testToken.mint(owner.address, amount);

      // Send test tokens to escrow contract
      await testToken.transfer(dust2CashEscrow.address, amount);

      // Recover tokens
      await dust2CashEscrow.recoverERC20(testToken.address, amount);

      // Check tokens were recovered
      expect(await testToken.balanceOf(owner.address)).to.equal(amount);
    });

    it("Should not allow recovery of escrowed USDC", async function () {
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
