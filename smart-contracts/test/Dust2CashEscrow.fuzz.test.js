const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Dust2CashEscrow Fuzzing Tests", function () {
  async function deployContracts() {
    const [owner, feeCollector, user1, user2] = await ethers.getSigners();

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

    return { dust2CashEscrow, mockUSDC, owner, feeCollector, user1, user2 };
  }

  describe("Deposit Amount Fuzzing", function () {
    it("Should handle various deposit amounts within limits", async function () {
      const { dust2CashEscrow, mockUSDC, owner, user1 } = await loadFixture(
        deployContracts
      );

      // Test with random amounts between MIN_DEPOSIT_AMOUNT and MAX_DEPOSIT_AMOUNT
      for (let i = 0; i < 10; i++) {
        const amount = ethers.utils.parseUnits(
          (Math.floor(Math.random() * 900000) + 100).toString(), // Random between 100 and 1M
          6
        );
        const gasDebt = amount.mul(10).div(100); // 10% of deposit

        // Ensure owner has enough allowance and balance for each deposit
        await mockUSDC.mint(owner.address, amount); // Mint additional tokens for each test
        await mockUSDC.approve(dust2CashEscrow.address, amount);

        await dust2CashEscrow.depositForUser(user1.address, amount, gasDebt);

        const userAccount = await dust2CashEscrow.getUserAccountStatus(
          user1.address
        );
        expect(userAccount.escrowedAmount).to.equal(amount);
      }
    });

    it("Should reject deposits outside limits", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      // Test with amounts below minimum
      const tooSmall = ethers.utils.parseUnits("50", 6); // 50 USDC
      await expect(
        dust2CashEscrow.depositForUser(
          user1.address,
          tooSmall,
          tooSmall.div(10)
        )
      ).to.be.revertedWith("Amount below minimum");

      // Test with amounts above maximum
      const tooLarge = ethers.utils.parseUnits("2000000", 6); // 2M USDC
      await expect(
        dust2CashEscrow.depositForUser(
          user1.address,
          tooLarge,
          tooLarge.div(10)
        )
      ).to.be.revertedWith("Amount above maximum");
    });
  });

  describe("Gas Debt Fuzzing", function () {
    it("Should handle various gas debt percentages", async function () {
      const { dust2CashEscrow, mockUSDC, owner, user1 } = await loadFixture(
        deployContracts
      );

      const depositAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC

      // Test with random gas debt percentages between 0% and 10%
      for (let i = 0; i < 10; i++) {
        const percentage = Math.random() * 10;
        const gasDebt = depositAmount
          .mul(Math.floor(percentage * 100))
          .div(10000);

        // Ensure owner has enough allowance
        await mockUSDC.mint(owner.address, depositAmount); // Mint additional tokens for each test
        await mockUSDC.approve(dust2CashEscrow.address, depositAmount);

        await dust2CashEscrow.depositForUser(
          user1.address,
          depositAmount,
          gasDebt
        );

        const userAccount = await dust2CashEscrow.getUserAccountStatus(
          user1.address
        );

        // Instead of checking for a specific value on the last iteration,
        // verify that the debt is within the expected range (0-10% of deposit)
        const maxPossibleDebt = depositAmount.mul(10).div(100); // 10% of deposit
        expect(userAccount.outstandingDebt).to.be.at.most(maxPossibleDebt);
        expect(userAccount.outstandingDebt).to.be.at.least(0);

        // Also verify it matches what we expect based on our calculation
        expect(userAccount.outstandingDebt).to.equal(gasDebt);
      }
    });

    it("Should reject gas debt above maximum percentage", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      const depositAmount = ethers.utils.parseUnits("1000", 6);
      const tooHighGasDebt = depositAmount.mul(11).div(100); // 11% of deposit

      await expect(
        dust2CashEscrow.depositForUser(
          user1.address,
          depositAmount,
          tooHighGasDebt
        )
      ).to.be.revertedWith("Gas debt too high");
    });
  });

  describe("Reputation Score Fuzzing", function () {
    it("Should handle various reputation score changes", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      // Test with random reputation scores
      for (let i = 0; i < 10; i++) {
        const newScore = Math.floor(Math.random() * 101); // Random between 0 and 100

        await expect(
          dust2CashEscrow.setReputationScore(user1.address, newScore)
        ).to.not.be.reverted;

        const userAccount = await dust2CashEscrow.getUserAccountStatus(
          user1.address
        );
        expect(userAccount.reputationScore).to.equal(newScore);
      }
    });

    it("Should reject reputation scores above maximum", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      await expect(
        dust2CashEscrow.setReputationScore(user1.address, 101)
      ).to.be.revertedWith("Score exceeds maximum");
    });
  });

  describe("Service Fee Fuzzing", function () {
    it("Should handle various service fee rates", async function () {
      const { dust2CashEscrow } = await loadFixture(deployContracts);

      // Test with random fee rates between 0% and 10%
      for (let i = 0; i < 10; i++) {
        const newRate = Math.floor(Math.random() * 1001); // Random between 0 and 1000 (0-10%)

        await expect(dust2CashEscrow.setPendingFeeRate(newRate)).to.not.be
          .reverted;

        // Fast forward time to bypass timelock
        await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days
        await ethers.provider.send("evm_mine");

        await expect(dust2CashEscrow.confirmFeeRate()).to.not.be.reverted;
      }
    });

    it("Should reject service fee rates above maximum", async function () {
      const { dust2CashEscrow } = await loadFixture(deployContracts);

      await expect(dust2CashEscrow.setPendingFeeRate(1001)).to.be.revertedWith(
        "Fee cannot exceed 10%"
      );
    });
  });

  describe("Blacklist Timeout Fuzzing", function () {
    it("Should handle blacklist timeout correctly", async function () {
      const { dust2CashEscrow, user1 } = await loadFixture(deployContracts);

      // Deposit and mark missed repayment to blacklist user
      const depositAmount = ethers.utils.parseUnits("1000", 6);
      const gasDebt = depositAmount.div(10);

      await dust2CashEscrow.depositForUser(
        user1.address,
        depositAmount,
        gasDebt
      );
      await dust2CashEscrow.markMissedRepayment(user1.address);
      await dust2CashEscrow.markMissedRepayment(user1.address);

      // Fast forward time to just before blacklist expires
      await ethers.provider.send("evm_increaseTime", [6 * 24 * 60 * 60]); // 6 days
      await ethers.provider.send("evm_mine");

      // Should still be blacklisted
      let userAccount = await dust2CashEscrow.getUserAccountStatus(
        user1.address
      );
      expect(userAccount.isBlacklisted).to.be.true;

      // Fast forward past blacklist timeout
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 more days
      await ethers.provider.send("evm_mine");

      // Should be able to deposit again (unblacklisted)
      await expect(
        dust2CashEscrow.depositForUser(user1.address, depositAmount, gasDebt)
      ).to.not.be.reverted;
    });
  });
});
