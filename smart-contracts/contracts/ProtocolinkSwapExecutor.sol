// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ProtocolinkSwapExecutor
 * @dev Contract to execute token swaps through Protocolink DEX aggregator
 */
contract ProtocolinkSwapExecutor is Ownable, ReentrancyGuard {
    // Events
    event SwapExecuted(
        address indexed user,
        address indexed fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 toAmount,
        bytes32 indexed quoteId
    );
    
    event RouterUpdated(address indexed newRouter);
    
    // Address of the Protocolink DEX aggregator/router
    address public router;
    
    constructor() Ownable() {
        // Router will be set after deployment
    }
    
    /**
     * @dev Update router address
     * @param _newRouter New Protocolink router address
     */
    function updateRouter(address _newRouter) external onlyOwner {
        require(_newRouter != address(0), "Invalid router address");
        router = _newRouter;
        emit RouterUpdated(_newRouter);
    }
    
    /**
     * @dev Execute a swap through Protocolink
     * @param _fromToken Address of the token to swap from
     * @param _toToken Address of the token to swap to
     * @param _amount Amount of fromToken to swap
     * @param _quoteId Quote ID from Protocolink
     * @param _swapData Calldata for the Protocolink swap
     */
    function executeSwap(
        address _fromToken,
        address _toToken,
        uint256 _amount,
        bytes32 _quoteId,
        bytes calldata _swapData
    ) external nonReentrant {
        require(router != address(0), "Router not set");
        require(_fromToken != address(0), "Invalid from token");
        require(_toToken != address(0), "Invalid to token");
        require(_amount > 0, "Invalid amount");
        require(_swapData.length > 0, "Invalid swap data");
        
        // Transfer tokens from user to this contract
        IERC20(_fromToken).transferFrom(msg.sender, address(this), _amount);
        
        // Approve router to spend tokens
        IERC20(_fromToken).approve(router, _amount);
        
        // Execute the swap through Protocolink
        (bool success, ) = router.call(_swapData);
        require(success, "Swap failed");
        
        // Get the balance of received tokens
        uint256 receivedAmount = IERC20(_toToken).balanceOf(address(this));
        require(receivedAmount > 0, "No tokens received");
        
        // Transfer received tokens to user
        IERC20(_toToken).transfer(msg.sender, receivedAmount);
        
        emit SwapExecuted(
            msg.sender,
            _fromToken,
            _toToken,
            _amount,
            receivedAmount,
            _quoteId
        );
    }
    
    /**
     * @dev Emergency function to recover stuck tokens
     * @param _token Address of the token to recover
     * @param _amount Amount to recover
     */
    function recoverTokens(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
} 