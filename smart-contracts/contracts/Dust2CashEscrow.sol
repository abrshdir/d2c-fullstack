// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Dust2CashEscrow
 * @dev Smart contract for Dust2Cash that handles USDC escrow, gas loan tracking, and user reputation management.
 * This contract securely holds USDC after token swaps, tracks outstanding gas loans, enforces repayment,
 * and maintains a reputation system to incentivize good behavior.
 */
contract Dust2CashEscrow is Ownable, ReentrancyGuard, Pausable {
    // USDC token interface
    IERC20 public usdcToken;
    
    // Minimum reputation score required for gas loans
    uint256 public constant MIN_REPUTATION_SCORE = 50;
    
    // Maximum reputation score
    uint256 public constant MAX_REPUTATION_SCORE = 100;
    
    // Default starting reputation for new users
    uint256 public constant DEFAULT_REPUTATION = 70;
    
    // Reputation increase for successful repayment
    uint256 public constant REPAYMENT_REPUTATION_INCREASE = 5;
    
    // Reputation decrease for missed repayment
    uint256 public constant MISSED_REPAYMENT_PENALTY = 20;
    
    // Blacklist timeout in seconds (7 days)
    uint256 public constant BLACKLIST_TIMEOUT = 7 days;
    
    // Timelock period for critical functions (2 days)
    uint256 public constant TIMELOCK_PERIOD = 2 days;
    
    // Maximum deposit amount (1M USDC)
    uint256 public constant MAX_DEPOSIT_AMOUNT = 1_000_000 * 10**6;
    
    // Maximum gas debt (10% of deposit)
    uint256 public constant MAX_GAS_DEBT_PERCENTAGE = 1000; // 10%
    
    // Minimum deposit amount (100 USDC)
    uint256 public constant MIN_DEPOSIT_AMOUNT = 100 * 10**6;
    
    // Structure to track user escrow and loan details
    struct UserAccount {
        uint256 escrowedAmount;      // Amount of USDC held in escrow
        uint256 outstandingDebt;     // Amount of gas loan to be repaid
        uint256 reputationScore;     // User reputation score (0-100)
        bool isBlacklisted;          // Whether user is blacklisted
        uint256 blacklistUntil;      // Timestamp when blacklist expires
        uint256 lastDepositTime;     // Timestamp of last deposit
        uint256 totalDeposited;      // Total amount ever deposited
        uint256 totalWithdrawn;      // Total amount ever withdrawn
        uint256 loansRepaid;         // Number of loans successfully repaid
        uint256 loansMissed;         // Number of loans not repaid
        uint256 lastLoanTime;        // Timestamp of last loan
    }
    
    // Mapping from user address to their account details
    mapping(address => UserAccount) public userAccounts;
    
    // Total USDC held in escrow
    uint256 public totalEscrowed;
    
    // Total outstanding debt across all users
    uint256 public totalOutstandingDebt;
    
    // Service fee percentage (in basis points, e.g., 100 = 1%)
    uint256 public serviceFeeRate = 200; // 2% default
    
    // Address where service fees are sent
    address public feeCollector;
    
    // Pending admin changes
    address public pendingFeeCollector;
    uint256 public pendingFeeRate;
    uint256 public pendingChangeTimestamp;
    
    // Events for transparency and tracking
    event Deposited(address indexed user, uint256 amount, uint256 gasDebt);
    event GasLoanRepaid(address indexed user, uint256 amount);
    event FundsReleased(address indexed user, uint256 amount);
    event ReputationUpdated(address indexed user, uint256 newScore);
    event UserBlacklisted(address indexed user, uint256 until);
    event UserUnblacklisted(address indexed user);
    event ServiceFeeUpdated(uint256 newRate);
    event FeeCollectorUpdated(address newCollector);
    event PendingFeeCollectorSet(address newCollector);
    event PendingFeeRateSet(uint256 newRate);
    
    /**
     * @dev Constructor sets the USDC token address and fee collector
     * @param _usdcToken Address of the USDC token contract
     * @param _feeCollector Address where service fees will be sent
     */
    constructor(address _usdcToken, address _feeCollector) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_feeCollector != address(0), "Invalid fee collector address");
        
        usdcToken = IERC20(_usdcToken);
        feeCollector = _feeCollector;
    }
    
    /**
     * @dev Deposits USDC into escrow and records gas debt
     * @param user Address of the user whose funds are being deposited
     * @param amount Amount of USDC to deposit
     * @param gasDebt Amount of gas debt to record
     */
    function depositForUser(address user, uint256 amount, uint256 gasDebt) external onlyOwner nonReentrant whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(amount >= MIN_DEPOSIT_AMOUNT, "Amount below minimum");
        require(amount <= MAX_DEPOSIT_AMOUNT, "Amount above maximum");
        require(gasDebt <= (amount * MAX_GAS_DEBT_PERCENTAGE) / 10000, "Gas debt too high");
        
        // Initialize new users with default reputation
        if (userAccounts[user].reputationScore == 0) {
            userAccounts[user].reputationScore = DEFAULT_REPUTATION;
        }
        
        // Check if user is blacklisted
        if (userAccounts[user].isBlacklisted) {
            if (block.timestamp > userAccounts[user].blacklistUntil) {
                // Blacklist period has expired, remove from blacklist
                userAccounts[user].isBlacklisted = false;
                emit UserUnblacklisted(user);
            } else {
                revert("User is blacklisted");
            }
        }
        
        // Transfer USDC from sender to this contract
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        // Update user account - replace previous values instead of adding to them
        userAccounts[user].escrowedAmount = amount;
        userAccounts[user].outstandingDebt = gasDebt;
        userAccounts[user].lastDepositTime = block.timestamp;
        userAccounts[user].totalDeposited += amount;
        userAccounts[user].lastLoanTime = block.timestamp;
        
        // Update global totals
        totalEscrowed += amount;
        totalOutstandingDebt += gasDebt;
        
        emit Deposited(user, amount, gasDebt);
    }
    
    /**
     * @dev Allows a user to repay their gas loan
     * @param amount Amount of gas debt to repay
     */
    function repayGasLoan(uint256 amount) external nonReentrant whenNotPaused {
        UserAccount storage account = userAccounts[msg.sender];
        
        require(!account.isBlacklisted, "User is blacklisted");
        require(account.outstandingDebt > 0, "No outstanding debt");
        require(amount > 0 && amount <= account.outstandingDebt, "Invalid repayment amount");
        require(account.escrowedAmount >= amount, "Insufficient escrowed funds");
        
        // Update user account
        account.outstandingDebt -= amount;
        account.escrowedAmount -= amount;
        
        // Update global totals
        totalEscrowed -= amount;
        totalOutstandingDebt -= amount;
        
        // Transfer repayment to fee collector
        require(usdcToken.transfer(feeCollector, amount), "USDC transfer failed");
        
        // Update reputation for successful repayment
        if (account.outstandingDebt == 0) {
            account.loansRepaid += 1;
            _increaseReputation(msg.sender, REPAYMENT_REPUTATION_INCREASE);
        }
        
        emit GasLoanRepaid(msg.sender, amount);
    }
    
    /**
     * @dev Allows a user to withdraw their remaining funds after repaying gas loan
     */
    function withdrawFunds() external nonReentrant whenNotPaused {
        UserAccount storage account = userAccounts[msg.sender];
        
        require(!account.isBlacklisted, "User is blacklisted");
        require(account.outstandingDebt == 0, "Outstanding debt must be repaid first");
        require(account.escrowedAmount > 0, "No funds to withdraw");
        
        uint256 amount = account.escrowedAmount;
        uint256 fee = (amount * serviceFeeRate) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        // Update user account
        account.escrowedAmount = 0;
        account.totalWithdrawn += amountAfterFee;
        
        // Update global total
        totalEscrowed -= amount;
        
        // Transfer funds to user and fee to collector
        require(usdcToken.transfer(msg.sender, amountAfterFee), "USDC transfer to user failed");
        require(usdcToken.transfer(feeCollector, fee), "USDC fee transfer failed");
        
        emit FundsReleased(msg.sender, amountAfterFee);
    }
    
    /**
     * @dev Allows owner to mark a user as having missed a repayment
     * @param user Address of the user who missed repayment
     */
    function markMissedRepayment(address user) external onlyOwner whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(userAccounts[user].outstandingDebt > 0, "No outstanding debt");
        
        userAccounts[user].loansMissed += 1;
        _decreaseReputation(user, MISSED_REPAYMENT_PENALTY);
        
        // If reputation falls below threshold, blacklist the user
        if (userAccounts[user].reputationScore < MIN_REPUTATION_SCORE) {
            userAccounts[user].isBlacklisted = true;
            userAccounts[user].blacklistUntil = block.timestamp + BLACKLIST_TIMEOUT;
            emit UserBlacklisted(user, userAccounts[user].blacklistUntil);
        }
    }
    
    /**
     * @dev Allows owner to set a new fee collector address (with timelock)
     * @param newCollector New fee collector address
     */
    function setPendingFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid fee collector address");
        pendingFeeCollector = newCollector;
        pendingChangeTimestamp = block.timestamp;
        emit PendingFeeCollectorSet(newCollector);
    }
    
    /**
     * @dev Allows owner to confirm the pending fee collector after timelock
     */
    function confirmFeeCollector() external onlyOwner {
        require(pendingFeeCollector != address(0), "No pending fee collector");
        require(block.timestamp >= pendingChangeTimestamp + TIMELOCK_PERIOD, "Timelock not expired");
        
        feeCollector = pendingFeeCollector;
        pendingFeeCollector = address(0);
        emit FeeCollectorUpdated(feeCollector);
    }
    
    /**
     * @dev Allows owner to set a new service fee rate (with timelock)
     * @param newRate New service fee rate in basis points
     */
    function setPendingFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Fee cannot exceed 10%");
        pendingFeeRate = newRate;
        pendingChangeTimestamp = block.timestamp;
        emit PendingFeeRateSet(newRate);
    }
    
    /**
     * @dev Allows owner to confirm the pending fee rate after timelock
     */
    function confirmFeeRate() external onlyOwner {
        require(pendingFeeRate > 0, "No pending fee rate");
        require(block.timestamp >= pendingChangeTimestamp + TIMELOCK_PERIOD, "Timelock not expired");
        
        serviceFeeRate = pendingFeeRate;
        pendingFeeRate = 0;
        emit ServiceFeeUpdated(serviceFeeRate);
    }
    
    /**
     * @dev Allows owner to manually adjust a user's reputation score
     * @param user Address of the user
     * @param newScore New reputation score
     */
    function setReputationScore(address user, uint256 newScore) external onlyOwner whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(newScore <= MAX_REPUTATION_SCORE, "Score exceeds maximum");
        
        userAccounts[user].reputationScore = newScore;
        emit ReputationUpdated(user, newScore);
    }
    
    /**
     * @dev Allows owner to remove a user from the blacklist
     * @param user Address of the user to unblacklist
     */
    function removeFromBlacklist(address user) external onlyOwner whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(userAccounts[user].isBlacklisted, "User is not blacklisted");
        
        userAccounts[user].isBlacklisted = false;
        emit UserUnblacklisted(user);
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Gets the current status of a user's account
     * @param user Address of the user
     * @return escrowedAmount Amount of USDC in escrow
     * @return outstandingDebt Amount of gas debt to be repaid
     * @return reputationScore User's reputation score
     * @return isBlacklisted Whether user is blacklisted
     */
    function getUserAccountStatus(address user) external view returns (
        uint256 escrowedAmount,
        uint256 outstandingDebt,
        uint256 reputationScore,
        bool isBlacklisted
    ) {
        UserAccount storage account = userAccounts[user];
        return (
            account.escrowedAmount,
            account.outstandingDebt,
            account.reputationScore,
            account.isBlacklisted
        );
    }
    
    /**
     * @dev Gets detailed statistics about a user's account
     * @param user Address of the user
     * @return totalDeposited Total amount ever deposited
     * @return totalWithdrawn Total amount ever withdrawn
     * @return loansRepaid Number of loans successfully repaid
     * @return loansMissed Number of loans not repaid
     * @return lastDepositTime Timestamp of last deposit
     */
    function getUserAccountStats(address user) external view returns (
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 loansRepaid,
        uint256 loansMissed,
        uint256 lastDepositTime
    ) {
        UserAccount storage account = userAccounts[user];
        return (
            account.totalDeposited,
            account.totalWithdrawn,
            account.loansRepaid,
            account.loansMissed,
            account.lastDepositTime
        );
    }
    
    /**
     * @dev Internal function to increase a user's reputation score
     * @param user Address of the user
     * @param amount Amount to increase reputation by
     */
    function _increaseReputation(address user, uint256 amount) internal {
        UserAccount storage account = userAccounts[user];
        
        if (account.reputationScore + amount > MAX_REPUTATION_SCORE) {
            account.reputationScore = MAX_REPUTATION_SCORE;
        } else {
            account.reputationScore += amount;
        }
        
        emit ReputationUpdated(user, account.reputationScore);
    }
    
    /**
     * @dev Internal function to decrease a user's reputation score
     * @param user Address of the user
     * @param amount Amount to decrease reputation by
     */
    function _decreaseReputation(address user, uint256 amount) internal {
        UserAccount storage account = userAccounts[user];
        
        if (amount >= account.reputationScore) {
            account.reputationScore = 0;
        } else {
            account.reputationScore -= amount;
        }
        
        emit ReputationUpdated(user, account.reputationScore);
    }
    
    /**
     * @dev Emergency function to recover any ERC20 tokens accidentally sent to the contract
     * @param tokenAddress Address of the token to recover
     * @param amount Amount to recover
     */
    function recoverERC20(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(usdcToken), "Cannot recover escrowed USDC");
        IERC20(tokenAddress).transfer(owner(), amount);
    }
}