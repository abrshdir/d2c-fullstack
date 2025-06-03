// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CollateralLock
 * @dev Smart contract that implements gas-loan logic for the Dust2Cash service.
 * This contract locks collateral from users, tracks loan amounts, and provides
 * functionality for withdrawals and staking on SUI.
 */
contract CollateralLock is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC token interface
    IERC20 public usdc;

    // State variables
    mapping(address => uint256) public collateral;
    mapping(address => uint256) public loanOwed;
    address public relayer;

    // Events
    /**
     * @dev Emitted when collateral is locked for a user
     * @param user Address of the user whose collateral is locked
     * @param amount Amount of USDC locked as collateral
     * @param loanAmount Amount of gas loan provided to the user
     */
    event CollateralLocked(address indexed user, uint256 amount, uint256 loanAmount);

    /**
     * @dev Emitted when a user withdraws their funds after repaying the loan
     * @param user Address of the user who withdrew funds
     * @param payout Amount of USDC paid out to the user
     */
    event Withdrawn(address indexed user, uint256 payout);

    /**
     * @dev Emitted when a user requests to stake their collateral on SUI
     * @param user Address of the user requesting to stake
     * @param amount Amount of collateral to be staked
     * @param discountRate Discount rate applied to the loan amount
     */
    event StakeRequested(address indexed user, uint256 amount, uint8 discountRate);

    /**
     * @dev Emitted when rewards are finalized for a user
     * @param user Address of the user receiving rewards
     * @param repaid Amount repaid from the collateral
     * @param payout Amount paid out to the user
     */
    event Finalized(address indexed user, uint256 repaid, uint256 payout);

    /**
     * @dev Modifier to restrict access to the relayer only
     */
    modifier onlyRelayer() {
        require(msg.sender == relayer, "CollateralLock: caller is not the relayer");
        _;
    }

    /**
     * @dev Constructor sets the USDC token address and relayer address
     * @param _usdc Address of the USDC token contract
     * @param _relayer Address of the relayer that will call lockCollateral
     */
    constructor(address _usdc, address _relayer) {
        require(_usdc != address(0), "CollateralLock: invalid USDC address");
        require(_relayer != address(0), "CollateralLock: invalid relayer address");
        
        usdc = IERC20(_usdc);
        relayer = _relayer;
    }

    /**
     * @dev Locks collateral for a user and records the loan amount
     * @param user Address of the user whose collateral is being locked
     * @param amount Amount of USDC to lock as collateral
     * @param loanAmount Amount of gas loan provided to the user
     */
    function lockCollateral(address user, uint256 amount, uint256 loanAmount) external onlyRelayer nonReentrant {
        require(user != address(0), "CollateralLock: invalid user address");
        require(amount > 0, "CollateralLock: amount must be greater than 0");
        require(loanAmount > 0, "CollateralLock: loan amount must be greater than 0");
        
        // Transfer USDC from relayer to this contract
        usdc.safeTransferFrom(relayer, address(this), amount);
        
        // Update user's collateral and loan amounts
        collateral[user] += amount;
        loanOwed[user] = loanAmount;
        
        emit CollateralLocked(user, amount, loanAmount);
    }

    /**
     * @dev Allows a user to withdraw their remaining funds after repaying the loan
     */
    function withdraw() external nonReentrant {
        require(collateral[msg.sender] > 0, "CollateralLock: no collateral to withdraw");
        require(collateral[msg.sender] >= loanOwed[msg.sender], "CollateralLock: collateral less than loan owed");
        
        // Calculate payout amount
        uint256 payout = collateral[msg.sender] - loanOwed[msg.sender];
        
        // Reset user's collateral and loan amounts
        collateral[msg.sender] = 0;
        loanOwed[msg.sender] = 0;
        
        // Transfer payout to user
        usdc.safeTransfer(msg.sender, payout);
        
        emit Withdrawn(msg.sender, payout);
    }

    /**
     * @dev Allows a user to stake their collateral on SUI with a discount on the loan amount
     * @param discountRate Discount rate to apply to the loan amount (0-100%)
     */
    function stakeOnSui(uint8 discountRate) external nonReentrant {
        require(collateral[msg.sender] > 0, "CollateralLock: no collateral to stake");
        require(discountRate <= 100, "CollateralLock: discount rate cannot exceed 100%");
        
        // Apply discount to loan amount
        loanOwed[msg.sender] = loanOwed[msg.sender] * (100 - discountRate) / 100;
        
        emit StakeRequested(msg.sender, collateral[msg.sender], discountRate);
    }

    /**
     * @dev Finalizes rewards for a user after staking
     * @param user Address of the user receiving rewards
     * @param repayAmount Amount to repay from the collateral
     * @param payoutAmount Amount to pay out to the user
     */
    function finalizeRewards(address user, uint256 repayAmount, uint256 payoutAmount) external onlyRelayer nonReentrant {
        require(user != address(0), "CollateralLock: invalid user address");
        require(collateral[user] > 0, "CollateralLock: user has no collateral");
        require(repayAmount <= collateral[user], "CollateralLock: repay amount exceeds collateral");
        
        // Subtract repay amount from collateral
        collateral[user] -= repayAmount;
        
        // If there's a payout, transfer it to the user
        if (payoutAmount > 0) {
            usdc.safeTransfer(user, payoutAmount);
        }
        
        // Reset user's collateral and loan amounts
        loanOwed[user] = 0;
        collateral[user] = 0;
        
        emit Finalized(user, repayAmount, payoutAmount);
    }
}