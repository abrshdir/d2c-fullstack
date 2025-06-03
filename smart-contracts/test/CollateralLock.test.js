const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CollateralLock", function () {
  let collateralLock;
  let mockUSDC;
  let owner;
  let relayer;
  let user1;
  let user2;

  const initialMint = ethers.utils.parseUnits("10000", 6); // 10,000 USDC
  const collateralAmount = ethers.utils.parseUnits("1000", 6); // 1,000 USDC
  const loanAmount = ethers.utils.parseUnits("50", 6); // 50 USDC gas loan

  beforeEach(async function () {
    // Get signers
    [owner, relayer, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Deploy CollateralLock
    const CollateralLock = await ethers.getContractFactory("CollateralLock");
    collateralLock = await CollateralLock.deploy(
      mockUSDC.address,
      relayer.address
    );
    await collateralLock.deployed();

    // Mint USDC to relayer for testing
    await mockUSDC.mint(relayer.address, initialMint);

    // Approve collateral lock contract to spend relayer's USDC
    await mockUSDC
      .connect(relayer)
      .approve(collateralLock.address, initialMint);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await collateralLock.owner()).to.equal(owner.address);
    });

    it("Should set the right USDC token", async function () {
      expect(await collateralLock.usdc()).to.equal(mockUSDC.address);
    });

    it("Should set the right relayer", async function () {
      expect(await collateralLock.relayer()).to.equal(relayer.address);
    });
  });

  describe("Lock Collateral", function () {
    it("Should lock collateral and record loan amount", async function () {
      await collateralLock
        .connect(relayer)
        .lockCollateral(user1.address, collateralAmount, loanAmount);

      expect(await collateralLock.collateral(user1.address)).to.equal(
        collateralAmount
      );
      expect(await collateralLock.loanOwed(user1.address)).to.equal(loanAmount);
      expect(await mockUSDC.balanceOf(collateralLock.address)).to.equal(
        collateralAmount
      );
    });

    it("Should fail if caller is not relayer", async function () {
      await expect(
        collateralLock
          .connect(user1)
          .lockCollateral(user1.address, collateralAmount, loanAmount)
      ).to.be.revertedWith("CollateralLock: caller is not the relayer");
    });

    it("Should fail if amount is zero", async function () {
      await expect(
        collateralLock
          .connect(relayer)
          .lockCollateral(user1.address, 0, loanAmount)
      ).to.be.revertedWith("CollateralLock: amount must be greater than 0");
    });

    it("Should fail if loan amount is zero", async function () {
      await expect(
        collateralLock
          .connect(relayer)
          .lockCollateral(user1.address, collateralAmount, 0)
      ).to.be.revertedWith(
        "CollateralLock: loan amount must be greater than 0"
      );
    });

    it("Should emit CollateralLocked event", async function () {
      await expect(
        collateralLock
          .connect(relayer)
          .lockCollateral(user1.address, collateralAmount, loanAmount)
      )
        .to.emit(collateralLock, "CollateralLocked")
        .withArgs(user1.address, collateralAmount, loanAmount);
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      // Lock collateral for user1
      await collateralLock
        .connect(relayer)
        .lockCollateral(user1.address, collateralAmount, loanAmount);
    });

    it("Should allow user to withdraw after repaying loan", async function () {
      const expectedPayout = collateralAmount.sub(loanAmount);
      const initialBalance = await mockUSDC.balanceOf(user1.address);

      await collateralLock.connect(user1).withdraw();

      // Check user's collateral and loan are reset
      expect(await collateralLock.collateral(user1.address)).to.equal(0);
      expect(await collateralLock.loanOwed(user1.address)).to.equal(0);

      // Check user received the correct payout
      const finalBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalBalance.sub(initialBalance)).to.equal(expectedPayout);
    });

    it("Should fail if user has no collateral", async function () {
      await expect(collateralLock.connect(user2).withdraw()).to.be.revertedWith(
        "CollateralLock: no collateral to withdraw"
      );
    });

    it("Should fail if collateral is less than loan owed", async function () {
      // Set up a scenario where collateral < loanOwed
      await collateralLock.connect(relayer).lockCollateral(
        user2.address,
        loanAmount.div(2), // Half of the loan amount
        loanAmount
      );

      await expect(collateralLock.connect(user2).withdraw()).to.be.revertedWith(
        "CollateralLock: collateral less than loan owed"
      );
    });

    it("Should emit Withdrawn event", async function () {
      const expectedPayout = collateralAmount.sub(loanAmount);

      await expect(collateralLock.connect(user1).withdraw())
        .to.emit(collateralLock, "Withdrawn")
        .withArgs(user1.address, expectedPayout);
    });
  });

  describe("Stake on SUI", function () {
    beforeEach(async function () {
      // Lock collateral for user1
      await collateralLock
        .connect(relayer)
        .lockCollateral(user1.address, collateralAmount, loanAmount);
    });

    it("Should apply discount to loan amount", async function () {
      const discountRate = 20; // 20% discount
      const expectedLoanAfterDiscount = loanAmount.mul(80).div(100); // 80% of original loan

      await collateralLock.connect(user1).stakeOnSui(discountRate);

      expect(await collateralLock.loanOwed(user1.address)).to.equal(
        expectedLoanAfterDiscount
      );
    });

    it("Should fail if user has no collateral", async function () {
      await expect(
        collateralLock.connect(user2).stakeOnSui(20)
      ).to.be.revertedWith("CollateralLock: no collateral to stake");
    });

    it("Should fail if discount rate exceeds 100%", async function () {
      await expect(
        collateralLock.connect(user1).stakeOnSui(101)
      ).to.be.revertedWith("CollateralLock: discount rate cannot exceed 100%");
    });

    it("Should emit StakeRequested event", async function () {
      const discountRate = 20;

      await expect(collateralLock.connect(user1).stakeOnSui(discountRate))
        .to.emit(collateralLock, "StakeRequested")
        .withArgs(user1.address, collateralAmount, discountRate);
    });
  });

  describe("Finalize Rewards", function () {
    beforeEach(async function () {
      // Lock collateral for user1
      await collateralLock
        .connect(relayer)
        .lockCollateral(user1.address, collateralAmount, loanAmount);

      // Apply discount through staking
      await collateralLock.connect(user1).stakeOnSui(20);
    });

    it("Should finalize rewards with payout", async function () {
      const repayAmount = loanAmount.mul(80).div(100); // 80% of original loan (after discount)
      const payoutAmount = collateralAmount.sub(repayAmount);
      const initialBalance = await mockUSDC.balanceOf(user1.address);

      await collateralLock
        .connect(relayer)
        .finalizeRewards(user1.address, repayAmount, payoutAmount);

      // Check user's collateral and loan are reset
      expect(await collateralLock.collateral(user1.address)).to.equal(0);
      expect(await collateralLock.loanOwed(user1.address)).to.equal(0);

      // Check user received the correct payout
      const finalBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalBalance.sub(initialBalance)).to.equal(payoutAmount);
    });

    it("Should finalize rewards without payout", async function () {
      const repayAmount = loanAmount.mul(80).div(100); // 80% of original loan (after discount)
      const initialBalance = await mockUSDC.balanceOf(user1.address);

      await collateralLock.connect(relayer).finalizeRewards(
        user1.address,
        repayAmount,
        0 // No payout
      );

      // Check user's collateral and loan are reset
      expect(await collateralLock.collateral(user1.address)).to.equal(0);
      expect(await collateralLock.loanOwed(user1.address)).to.equal(0);

      // Check user balance didn't change
      const finalBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance);
    });

    it("Should fail if caller is not relayer", async function () {
      await expect(
        collateralLock
          .connect(user1)
          .finalizeRewards(user1.address, loanAmount, 0)
      ).to.be.revertedWith("CollateralLock: caller is not the relayer");
    });

    it("Should fail if repay amount exceeds collateral", async function () {
      const excessiveRepayAmount = collateralAmount.add(1);

      await expect(
        collateralLock
          .connect(relayer)
          .finalizeRewards(user1.address, excessiveRepayAmount, 0)
      ).to.be.revertedWith("CollateralLock: repay amount exceeds collateral");
    });

    it("Should emit Finalized event", async function () {
      const repayAmount = loanAmount.mul(80).div(100);
      const payoutAmount = collateralAmount.sub(repayAmount);

      await expect(
        collateralLock
          .connect(relayer)
          .finalizeRewards(user1.address, repayAmount, payoutAmount)
      )
        .to.emit(collateralLock, "Finalized")
        .withArgs(user1.address, repayAmount, payoutAmount);
    });
  });
});
