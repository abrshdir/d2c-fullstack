// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Treasury
 * @dev Smart contract that manages funds for the Dust2Cash gas-loan platform.
 * This contract handles funding gas operations, collecting repaid loans,
 * managing protocol fees, and implementing security measures.
 */
contract Treasury is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // USDC token interface
    IERC20 public usdc;

    // Addresses
    address public relayer;
    address public collateralLock;
    address[] public operators;
    mapping(address => bool) public isOperator;

    // Timelock settings
    uint256 public constant TIMELOCK_PERIOD = 2 days;
    mapping(bytes32 => uint256) public timelockExpiries;
    mapping(bytes32 => bool) public timelockExecuted;

    // Withdrawal limits
    uint256 public dailyWithdrawalLimit;
    uint256 public withdrawnToday;
    uint256 public withdrawalDay;

    // Multi-sig settings
    uint256 public requiredSignatures;
    mapping(bytes32 => mapping(address => bool)) public operatorApprovals;
    mapping(bytes32 => uint256) public approvalCount;

    // Events
    event RelayerFunded(address indexed relayer, uint256 amount);
    event FeesCollected(uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event WithdrawalLimitUpdated(uint256 newLimit);
    event RelayerUpdated(address indexed newRelayer);
    event CollateralLockUpdated(address indexed newCollateralLock);
    event RequiredSignaturesUpdated(uint256 newRequiredSignatures);
    event TimelockInitiated(bytes32 indexed operationId, uint256 expiryTime);
    event TimelockExecuted(bytes32 indexed operationId);
    event OperationApproved(bytes32 indexed operationId, address indexed operator);

    /**
     * @dev Constructor sets the USDC token address, relayer, collateral lock, and initial withdrawal limit
     * @param _usdc Address of the USDC token contract
     * @param _relayer Address of the relayer that will be funded for gas operations
     * @param _collateralLock Address of the collateral lock contract
     * @param _dailyWithdrawalLimit Initial daily withdrawal limit
     */
    constructor(
        address _usdc,
        address _relayer,
        address _collateralLock,
        uint256 _dailyWithdrawalLimit
    ) {
        require(_usdc != address(0), "Treasury: invalid USDC address");
        require(_relayer != address(0), "Treasury: invalid relayer address");
        require(_collateralLock != address(0), "Treasury: invalid collateral lock address");
        
        usdc = IERC20(_usdc);
        relayer = _relayer;
        collateralLock = _collateralLock;
        dailyWithdrawalLimit = _dailyWithdrawalLimit;
        
        // Add owner as the first operator
        _addOperator(msg.sender);
        requiredSignatures = 1; // Initially only require 1 signature (owner)
    }

    /**
     * @dev Modifier to restrict access to operators only
     */
    modifier onlyOperator() {
        require(isOperator[msg.sender], "Treasury: caller is not an operator");
        _;
    }

    /**
     * @dev Modifier to check if a timelock has expired
     * @param operationId The ID of the timelocked operation
     */
    modifier timelockExpired(bytes32 operationId) {
        require(timelockExpiries[operationId] > 0, "Treasury: timelock not initiated");
        require(block.timestamp >= timelockExpiries[operationId], "Treasury: timelock not expired");
        require(!timelockExecuted[operationId], "Treasury: operation already executed");
        _;
    }

    /**
     * @dev Modifier to check if an operation has enough approvals
     * @param operationId The ID of the operation requiring approvals
     */
    modifier hasRequiredApprovals(bytes32 operationId) {
        require(approvalCount[operationId] >= requiredSignatures, "Treasury: insufficient approvals");
        _;
    }

    /**
     * @dev Funds the relayer for gas operations
     * @param amount Amount of USDC to send to the relayer
     */
    function fundRelayer(uint256 amount) external nonReentrant whenNotPaused onlyOperator {
        require(amount > 0, "Treasury: amount must be greater than 0");
        require(usdc.balanceOf(address(this)) >= amount, "Treasury: insufficient balance");
        
        // Reset daily withdrawal limit if it's a new day
        _updateWithdrawalDay();
        
        // Check if this withdrawal would exceed the daily limit
        require(withdrawnToday + amount <= dailyWithdrawalLimit, "Treasury: daily withdrawal limit exceeded");
        
        // Update withdrawn amount
        withdrawnToday += amount;
        
        // Transfer USDC to relayer
        usdc.safeTransfer(relayer, amount);
        
        emit RelayerFunded(relayer, amount);
    }

    /**
     * @dev Collects fees from protocol operations
     * @notice This function is called when fees are sent to the treasury
     */
    function collectFees() external nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        emit FeesCollected(balance);
    }

    /**
     * @dev Withdraws funds from the treasury with multi-sig approval
     * @param to Address to send funds to
     * @param amount Amount of USDC to withdraw
     * @param operationId Unique identifier for this withdrawal operation
     */
    function withdrawFunds(address to, uint256 amount, bytes32 operationId)
        external
        nonReentrant
        whenNotPaused
        onlyOperator
        hasRequiredApprovals(operationId)
    {
        require(to != address(0), "Treasury: invalid recipient address");
        require(amount > 0, "Treasury: amount must be greater than 0");
        require(usdc.balanceOf(address(this)) >= amount, "Treasury: insufficient balance");
        
        // Reset daily withdrawal limit if it's a new day
        _updateWithdrawalDay();
        
        // Check if this withdrawal would exceed the daily limit
        require(withdrawnToday + amount <= dailyWithdrawalLimit, "Treasury: daily withdrawal limit exceeded");
        
        // Update withdrawn amount
        withdrawnToday += amount;
        
        // Transfer USDC to recipient
        usdc.safeTransfer(to, amount);
        
        emit FundsWithdrawn(to, amount);
    }

    /**
     * @dev Approves an operation (used for multi-sig functionality)
     * @param operationId Unique identifier for the operation
     */
    function approveOperation(bytes32 operationId) external onlyOperator {
        require(!operatorApprovals[operationId][msg.sender], "Treasury: already approved");
        
        operatorApprovals[operationId][msg.sender] = true;
        approvalCount[operationId] += 1;
        
        emit OperationApproved(operationId, msg.sender);
    }

    /**
     * @dev Initiates a timelock for a sensitive operation
     * @param operationId Unique identifier for the operation
     */
    function initiateTimelock(bytes32 operationId) external onlyOperator {
        require(timelockExpiries[operationId] == 0, "Treasury: timelock already initiated");
        
        timelockExpiries[operationId] = block.timestamp + TIMELOCK_PERIOD;
        
        emit TimelockInitiated(operationId, timelockExpiries[operationId]);
    }

    /**
     * @dev Executes a timelocked operation
     * @param operationId Unique identifier for the operation
     */
    function executeTimelock(bytes32 operationId) external onlyOperator timelockExpired(operationId) {
        timelockExecuted[operationId] = true;
        
        emit TimelockExecuted(operationId);
    }

    /**
     * @dev Emergency withdrawal in case of critical issues
     * @param to Address to send funds to
     * @param amount Amount of USDC to withdraw
     * @param operationId Unique identifier for this emergency operation
     */
    function emergencyWithdrawal(address to, uint256 amount, bytes32 operationId)
        external
        nonReentrant
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        require(to != address(0), "Treasury: invalid recipient address");
        require(amount > 0, "Treasury: amount must be greater than 0");
        require(usdc.balanceOf(address(this)) >= amount, "Treasury: insufficient balance");
        
        // Transfer USDC to recipient
        usdc.safeTransfer(to, amount);
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
        
        emit EmergencyWithdrawal(to, amount);
    }

    /**
     * @dev Adds a new operator (part of multi-sig governance)
     * @param operator Address of the new operator
     * @param operationId Unique identifier for this operation
     */
    function addOperator(address operator, bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        _addOperator(operator);
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
    }

    /**
     * @dev Internal function to add a new operator
     * @param operator Address of the new operator
     */
    function _addOperator(address operator) internal {
        require(operator != address(0), "Treasury: invalid operator address");
        require(!isOperator[operator], "Treasury: already an operator");
        
        operators.push(operator);
        isOperator[operator] = true;
        
        emit OperatorAdded(operator);
    }

    /**
     * @dev Removes an operator
     * @param operator Address of the operator to remove
     * @param operationId Unique identifier for this operation
     */
    function removeOperator(address operator, bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        require(operator != address(0), "Treasury: invalid operator address");
        require(isOperator[operator], "Treasury: not an operator");
        require(operator != owner(), "Treasury: cannot remove owner as operator");
        
        // Find and remove the operator from the array
        for (uint256 i = 0; i < operators.length; i++) {
            if (operators[i] == operator) {
                operators[i] = operators[operators.length - 1];
                operators.pop();
                break;
            }
        }
        
        isOperator[operator] = false;
        
        emit OperatorRemoved(operator);
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
    }

    /**
     * @dev Updates the daily withdrawal limit
     * @param newLimit New daily withdrawal limit
     * @param operationId Unique identifier for this operation
     */
    function updateWithdrawalLimit(uint256 newLimit, bytes32 operationId) 
        external 
        onlyOwner 
        hasRequiredApprovals(operationId) 
    {
        dailyWithdrawalLimit = newLimit;
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
        
        emit WithdrawalLimitUpdated(newLimit);
    }

    /**
     * @dev Updates the relayer address
     * @param newRelayer New relayer address
     * @param operationId Unique identifier for this operation
     */
    function updateRelayer(address newRelayer, bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        require(newRelayer != address(0), "Treasury: invalid relayer address");
        
        relayer = newRelayer;
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
        
        emit RelayerUpdated(newRelayer);
    }

    /**
     * @dev Updates the collateral lock address
     * @param newCollateralLock New collateral lock address
     * @param operationId Unique identifier for this operation
     */
    function updateCollateralLock(address newCollateralLock, bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        require(newCollateralLock != address(0), "Treasury: invalid collateral lock address");
        
        collateralLock = newCollateralLock;
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
        
        emit CollateralLockUpdated(newCollateralLock);
    }

    /**
     * @dev Updates the required number of signatures for multi-sig operations
     * @param newRequiredSignatures New number of required signatures
     * @param operationId Unique identifier for this operation
     */
    function updateRequiredSignatures(uint256 newRequiredSignatures, bytes32 operationId) 
        external 
        onlyOwner 
        hasRequiredApprovals(operationId) 
    {
        require(newRequiredSignatures > 0, "Treasury: required signatures must be greater than 0");
        require(newRequiredSignatures <= operators.length, "Treasury: required signatures exceeds operator count");
        
        requiredSignatures = newRequiredSignatures;
        
        // Mark this operation as executed to prevent reuse
        timelockExecuted[operationId] = true;
        
        emit RequiredSignaturesUpdated(newRequiredSignatures);
    }

    /**
     * @dev Pauses the contract
     * @param operationId Unique identifier for this operation
     */
    function pause(bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     * @param operationId Unique identifier for this operation
     */
    function unpause(bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        _unpause();
    }

    /**
     * @dev Internal function to update the withdrawal day
     */
    function _updateWithdrawalDay() internal {
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > withdrawalDay) {
            withdrawalDay = currentDay;
            withdrawnToday = 0;
        }
    }

    /**
     * @dev Gets the list of all operators
     * @return Array of operator addresses
     */
    function getOperators() external view returns (address[] memory) {
        return operators;
    }

    /**
     * @dev Gets the approval status for an operation
     * @param operationId Unique identifier for the operation
     * @param operator Address of the operator
     * @return Whether the operator has approved the operation
     */
    function getApprovalStatus(bytes32 operationId, address operator) external view returns (bool) {
        return operatorApprovals[operationId][operator];
    }

    /**
     * @dev Gets the current treasury balance
     * @return Current USDC balance of the treasury
     */
    function getTreasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @dev Gets the remaining daily withdrawal limit
     * @return Remaining amount that can be withdrawn today
     */
    function getRemainingDailyLimit() external view returns (uint256) {
        if (block.timestamp / 1 days > withdrawalDay) {
            return dailyWithdrawalLimit;
        }
        return dailyWithdrawalLimit > withdrawnToday ? dailyWithdrawalLimit - withdrawnToday : 0;
    }

    /**
     * @dev Emergency function to recover any ERC20 tokens accidentally sent to the contract
     * @param tokenAddress Address of the token to recover
     * @param amount Amount to recover
     * @param operationId Unique identifier for this operation
     */
    function recoverERC20(address tokenAddress, uint256 amount, bytes32 operationId)
        external
        onlyOwner
        hasRequiredApprovals(operationId)
    {
        require(tokenAddress != address(usdc), "Treasury: cannot recover treasury USDC");
        IERC20(tokenAddress).safeTransfer(owner(), amount);
    }
}