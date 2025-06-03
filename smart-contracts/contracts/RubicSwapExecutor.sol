// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title RubicSwapExecutor
 * @dev Contract to execute Rubic swaps on-chain
 */
contract RubicSwapExecutor is Ownable, ReentrancyGuard {
    // Rubic router address - to be set by owner
    address public rubicRouter;
    
    // USDC addresses for different chains
    mapping(uint256 => address) public usdcAddresses;
    
    // Events
    event SwapExecuted(
        address indexed user,
        address indexed fromToken,
        address indexed toToken,
        uint256 fromAmount,
        uint256 toAmount,
        bytes32 indexed quoteId
    );
    
    event RouterUpdated(address indexed newRouter);
    event USDCAddressUpdated(uint256 indexed chainId, address indexed newAddress);
    
    constructor(address _rubicRouter) Ownable(msg.sender) {
        rubicRouter = _rubicRouter;
        
        // Initialize USDC addresses for different chains
        usdcAddresses[1] = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // Ethereum
        usdcAddresses[137] = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174; // Polygon
    }
    
    /**
     * @dev Update Rubic router address
     * @param _newRouter New router address
     */
    function updateRouter(address _newRouter) external onlyOwner {
        require(_newRouter != address(0), "Invalid router address");
        rubicRouter = _newRouter;
        emit RouterUpdated(_newRouter);
    }
    
    /**
     * @dev Update USDC address for a specific chain
     * @param _chainId Chain ID
     * @param _newAddress New USDC address
     */
    function updateUSDCAddress(uint256 _chainId, address _newAddress) external onlyOwner {
        require(_newAddress != address(0), "Invalid USDC address");
        usdcAddresses[_chainId] = _newAddress;
        emit USDCAddressUpdated(_chainId, _newAddress);
    }
    
    /**
     * @dev Execute a Rubic swap
     * @param _fromToken Address of the token to swap from
     * @param _toToken Address of the token to swap to
     * @param _amount Amount of fromToken to swap
     * @param _quoteId Quote ID from Rubic API
     * @param _swapData Calldata for the swap
     */
    function executeSwap(
        address _fromToken,
        address _toToken,
        uint256 _amount,
        bytes32 _quoteId,
        bytes calldata _swapData
    ) external nonReentrant {
        require(_fromToken != address(0), "Invalid from token");
        require(_toToken != address(0), "Invalid to token");
        require(_amount > 0, "Invalid amount");
        require(_swapData.length > 0, "Invalid swap data");
        
        // Transfer tokens from user to this contract
        IERC20(_fromToken).transferFrom(msg.sender, address(this), _amount);
        
        // Approve Rubic router to spend tokens
        IERC20(_fromToken).approve(rubicRouter, _amount);
        
        // Execute the swap
        (bool success, ) = rubicRouter.call(_swapData);
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