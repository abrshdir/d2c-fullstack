const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
  let treasury;
  let mockUSDC;
  let owner;
  let relayer;
  let collateralLock;
  let operator1;
  let operator2;
  let user;

  const DAILY_WITHDRAWAL_LIMIT = ethers.utils.parseUnits("10000", 6); // 10,000 USDC
  const TIMELOCK_PERIOD = 2 * 24 * 60 * 60; // 2 days in seconds

  beforeEach(async function () {
    // Get signers
    [owner, relayer, collateralLock, operator1, operator2, user] =
      await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(
      mockUSDC.address,
      relayer.address,
      collateralLock.address,
      DAILY_WITHDRAWAL_LIMIT
    );
    await treasury.deployed();

    // Fund the treasury with USDC
    await mockUSDC.transfer(
      treasury.address,
      ethers.utils.parseUnits("100000", 6)
    ); // 100,000 USDC
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await treasury.owner()).to.equal(owner.address);
    });

    it("Should set the right USDC address", async function () {
      expect(await treasury.usdc()).to.equal(mockUSDC.address);
    });

    it("Should set the right relayer address", async function () {
      expect(await treasury.relayer()).to.equal(relayer.address);
    });

    it("Should set the right collateral lock address", async function () {
      expect(await treasury.collateralLock()).to.equal(collateralLock.address);
    });

    it("Should set the right daily withdrawal limit", async function () {
      expect(await treasury.dailyWithdrawalLimit()).to.equal(
        DAILY_WITHDRAWAL_LIMIT
      );
    });

    it("Should add owner as the first operator", async function () {
      expect(await treasury.isOperator(owner.address)).to.be.true;
      const operators = await treasury.getOperators();
      expect(operators.length).to.equal(1);
      expect(operators[0]).to.equal(owner.address);
    });

    it("Should set required signatures to 1", async function () {
      expect(await treasury.requiredSignatures()).to.equal(1);
    });
  });

  describe("Operator Management", function () {
    let operationId;

    beforeEach(async function () {
      // Create a unique operation ID for each test
      operationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("add-operator-" + Date.now())
      );

      // Initiate timelock
      await treasury.initiateTimelock(operationId);

      // Approve operation
      await treasury.approveOperation(operationId);

      // Fast forward time to expire timelock
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");

      // Execute timelock
      await treasury.executeTimelock(operationId);
    });

    it("Should add a new operator", async function () {
      // Create a new operation ID
      const newOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("add-operator-new-" + Date.now())
      );

      // Initiate timelock
      await treasury.initiateTimelock(newOperationId);

      // Approve operation
      await treasury.approveOperation(newOperationId);

      // Fast forward time to expire timelock
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");

      // Execute timelock
      await treasury.executeTimelock(newOperationId);

      // Add operator
      await expect(treasury.addOperator(operator1.address, newOperationId))
        .to.emit(treasury, "OperatorAdded")
        .withArgs(operator1.address);

      // Check if operator was added
      expect(await treasury.isOperator(operator1.address)).to.be.true;
      const operators = await treasury.getOperators();
      expect(operators.length).to.equal(2);
      expect(operators[1]).to.equal(operator1.address);
    });

    it("Should remove an operator", async function () {
      // First add an operator
      const addOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("add-operator-for-removal-" + Date.now())
      );
      await treasury.initiateTimelock(addOperationId);
      await treasury.approveOperation(addOperationId);
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");
      await treasury.executeTimelock(addOperationId);
      await treasury.addOperator(operator1.address, addOperationId);

      // Create a new operation ID for removal
      const removeOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("remove-operator-" + Date.now())
      );

      // Initiate timelock
      await treasury.initiateTimelock(removeOperationId);

      // Approve operation
      await treasury.approveOperation(removeOperationId);

      // Fast forward time to expire timelock
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");

      // Execute timelock
      await treasury.executeTimelock(removeOperationId);

      // Remove operator
      await expect(
        treasury.removeOperator(operator1.address, removeOperationId)
      )
        .to.emit(treasury, "OperatorRemoved")
        .withArgs(operator1.address);

      // Check if operator was removed
      expect(await treasury.isOperator(operator1.address)).to.be.false;
      const operators = await treasury.getOperators();
      expect(operators.length).to.equal(1);
      expect(operators[0]).to.equal(owner.address);
    });

    it("Should not allow removing the owner as operator", async function () {
      // Create a new operation ID
      const removeOwnerOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("remove-owner-" + Date.now())
      );

      // Initiate timelock
      await treasury.initiateTimelock(removeOwnerOperationId);

      // Approve operation
      await treasury.approveOperation(removeOwnerOperationId);

      // Fast forward time to expire timelock
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");

      // Execute timelock
      await treasury.executeTimelock(removeOwnerOperationId);

      // Try to remove owner as operator
      await expect(
        treasury.removeOperator(owner.address, removeOwnerOperationId)
      ).to.be.revertedWith("Treasury: cannot remove owner as operator");
    });
  });

  describe("Fund Management", function () {
    it("Should fund the relayer", async function () {
      const fundAmount = ethers.utils.parseUnits("1000", 6); // 1,000 USDC
      const initialRelayerBalance = await mockUSDC.balanceOf(relayer.address);
      const initialTreasuryBalance = await mockUSDC.balanceOf(treasury.address);

      // Fund the relayer
      await expect(treasury.fundRelayer(fundAmount))
        .to.emit(treasury, "RelayerFunded")
        .withArgs(relayer.address, fundAmount);

      // Check balances
      expect(await mockUSDC.balanceOf(relayer.address)).to.equal(
        initialRelayerBalance.add(fundAmount)
      );
      expect(await mockUSDC.balanceOf(treasury.address)).to.equal(
        initialTreasuryBalance.sub(fundAmount)
      );

      // Check daily withdrawal tracking
      expect(await treasury.withdrawnToday()).to.equal(fundAmount);
    });

    it("Should not allow funding more than the daily limit", async function () {
      const exceedingAmount = DAILY_WITHDRAWAL_LIMIT.add(
        ethers.utils.parseUnits("1", 6)
      ); // Exceeds by 1 USDC

      // Try to fund the relayer with an amount exceeding the daily limit
      await expect(treasury.fundRelayer(exceedingAmount)).to.be.revertedWith(
        "Treasury: daily withdrawal limit exceeded"
      );
    });

    it("Should reset the daily withdrawal limit after a day", async function () {
      const fundAmount = ethers.utils.parseUnits("5000", 6); // 5,000 USDC

      // Fund the relayer
      await treasury.fundRelayer(fundAmount);

      // Check daily withdrawal tracking
      expect(await treasury.withdrawnToday()).to.equal(fundAmount);

      // Fast forward time by 1 day
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      // Fund the relayer again
      await treasury.fundRelayer(fundAmount);

      // Check daily withdrawal tracking (should be reset)
      expect(await treasury.withdrawnToday()).to.equal(fundAmount);
    });

    it("Should withdraw funds with multi-sig approval", async function () {
      // Add a second operator
      const addOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("add-operator-for-multisig-" + Date.now())
      );
      await treasury.initiateTimelock(addOperationId);
      await treasury.approveOperation(addOperationId);
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");
      await treasury.executeTimelock(addOperationId);
      await treasury.addOperator(operator1.address, addOperationId);

      // Update required signatures to 2
      const sigOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("update-signatures-" + Date.now())
      );
      await treasury.initiateTimelock(sigOperationId);
      await treasury.approveOperation(sigOperationId);
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");
      await treasury.executeTimelock(sigOperationId);
      await treasury.updateRequiredSignatures(2, sigOperationId);

      // Create withdrawal operation ID
      const withdrawalOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("withdraw-funds-" + Date.now())
      );

      // Approve operation by owner
      await treasury.approveOperation(withdrawalOperationId);

      // Approve operation by operator1
      await treasury.connect(operator1).approveOperation(withdrawalOperationId);

      // Check approval count
      expect(await treasury.approvalCount(withdrawalOperationId)).to.equal(2);

      // Withdraw funds
      const withdrawAmount = ethers.utils.parseUnits("2000", 6); // 2,000 USDC
      const initialUserBalance = await mockUSDC.balanceOf(user.address);
      const initialTreasuryBalance = await mockUSDC.balanceOf(treasury.address);

      await expect(
        treasury.withdrawFunds(
          user.address,
          withdrawAmount,
          withdrawalOperationId
        )
      )
        .to.emit(treasury, "FundsWithdrawn")
        .withArgs(user.address, withdrawAmount);

      // Check balances
      expect(await mockUSDC.balanceOf(user.address)).to.equal(
        initialUserBalance.add(withdrawAmount)
      );
      expect(await mockUSDC.balanceOf(treasury.address)).to.equal(
        initialTreasuryBalance.sub(withdrawAmount)
      );
    });
  });

  describe("Emergency Functions", function () {
    it("Should perform emergency withdrawal with timelock and multi-sig", async function () {
      // Create emergency operation ID for timelock
      const timelockOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("emergency-timelock-" + Date.now())
      );

      // Create emergency operation ID for withdrawal
      const withdrawalOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("emergency-withdrawal-" + Date.now())
      );

      // Initiate timelock
      await treasury.initiateTimelock(timelockOperationId);

      // Approve timelock operation
      await treasury.approveOperation(timelockOperationId);

      // Fast forward time to expire timelock
      await ethers.provider.send("evm_increaseTime", [TIMELOCK_PERIOD]);
      await ethers.provider.send("evm_mine");

      // Execute timelock
      await treasury.executeTimelock(timelockOperationId);

      // Approve withdrawal operation
      await treasury.approveOperation(withdrawalOperationId);

      // Perform emergency withdrawal
      const emergencyAmount = ethers.utils.parseUnits("50000", 6); // 50,000 USDC
      const initialUserBalance = await mockUSDC.balanceOf(user.address);
      const initialTreasuryBalance = await mockUSDC.balanceOf(treasury.address);

      await expect(
        treasury.emergencyWithdrawal(
          user.address,
          emergencyAmount,
          withdrawalOperationId
        )
      )
        .to.emit(treasury, "EmergencyWithdrawal")
        .withArgs(user.address, emergencyAmount);

      // Check balances
      expect(await mockUSDC.balanceOf(user.address)).to.equal(
        initialUserBalance.add(emergencyAmount)
      );
      expect(await mockUSDC.balanceOf(treasury.address)).to.equal(
        initialTreasuryBalance.sub(emergencyAmount)
      );
    });

    it("Should pause and unpause the contract", async function () {
      // Create pause operation ID
      const pauseOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("pause-contract-" + Date.now())
      );

      // Approve operation
      await treasury.approveOperation(pauseOperationId);

      // Pause the contract
      await treasury.pause(pauseOperationId);

      // Try to fund the relayer while paused
      const fundAmount = ethers.utils.parseUnits("1000", 6); // 1,000 USDC
      await expect(treasury.fundRelayer(fundAmount)).to.be.revertedWith(
        "Pausable: paused"
      );

      // Create unpause operation ID
      const unpauseOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("unpause-contract-" + Date.now())
      );

      // Approve operation
      await treasury.approveOperation(unpauseOperationId);

      // Unpause the contract
      await treasury.unpause(unpauseOperationId);

      // Fund the relayer after unpausing
      await expect(treasury.fundRelayer(fundAmount))
        .to.emit(treasury, "RelayerFunded")
        .withArgs(relayer.address, fundAmount);
    });

    it("Should recover ERC20 tokens", async function () {
      // Deploy a test token
      const TestToken = await ethers.getContractFactory("TestToken");
      const testToken = await TestToken.deploy();
      await testToken.deployed();

      // Mint some test tokens to owner and transfer to treasury
      const testAmount = ethers.utils.parseUnits("100", 6); // 100 TEST
      await testToken.mint(owner.address, ethers.utils.parseUnits("1000", 6));
      await testToken.transfer(treasury.address, testAmount);

      // Create recover operation ID
      const recoverOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("recover-tokens-" + Date.now())
      );

      // Approve operation
      await treasury.approveOperation(recoverOperationId);

      // Recover the test tokens
      await treasury.recoverERC20(
        testToken.address,
        testAmount,
        recoverOperationId
      );

      // Check balances
      expect(await testToken.balanceOf(treasury.address)).to.equal(0);
      expect(await testToken.balanceOf(owner.address)).to.equal(
        ethers.utils.parseUnits("1000", 6)
      ); // Initial supply
    });

    it("Should not allow recovering USDC", async function () {
      // Create recover operation ID
      const recoverOperationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("recover-usdc-" + Date.now())
      );

      // Approve operation
      await treasury.approveOperation(recoverOperationId);

      // Try to recover USDC
      const usdcAmount = ethers.utils.parseUnits("1000", 6); // 1,000 USDC
      await expect(
        treasury.recoverERC20(mockUSDC.address, usdcAmount, recoverOperationId)
      ).to.be.revertedWith("Treasury: cannot recover treasury USDC");
    });
  });

  describe("View Functions", function () {
    it("Should return the correct treasury balance", async function () {
      const balance = await treasury.getTreasuryBalance();
      expect(balance).to.equal(ethers.utils.parseUnits("100000", 6)); // 100,000 USDC
    });

    it("Should return the correct remaining daily limit", async function () {
      // Fund the relayer with 3,000 USDC
      const fundAmount = ethers.utils.parseUnits("3000", 6);
      await treasury.fundRelayer(fundAmount);

      // Check remaining daily limit
      const remainingLimit = await treasury.getRemainingDailyLimit();
      expect(remainingLimit).to.equal(DAILY_WITHDRAWAL_LIMIT.sub(fundAmount)); // 10,000 - 3,000 = 7,000 USDC
    });

    it("Should return the correct approval status", async function () {
      // Create operation ID
      const operationId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("test-approval-" + Date.now())
      );

      // Check initial approval status
      expect(await treasury.getApprovalStatus(operationId, owner.address)).to.be
        .false;

      // Approve operation
      await treasury.approveOperation(operationId);

      // Check updated approval status
      expect(await treasury.getApprovalStatus(operationId, owner.address)).to.be
        .true;
    });
  });
});
