module dust2cash_staking::reward_distributor {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    
    // Import Wormhole dependencies
    use wormhole::vaa;
    use wormhole::state::{State as WormholeState};
    use wormhole::external_address::{Self, ExternalAddress};
    use wormhole::bytes32::{Self, Bytes32};
    use wormhole::publish_message;
    
    // Import our staking module
    use dust2cash_staking::stake_module::{Self, StakingPosition};
    
    // Constants
    const ETHEREUM_CHAIN_ID: u16 = 2; // Wormhole chain ID for Ethereum
    const POLYGON_CHAIN_ID: u16 = 5; // Wormhole chain ID for Polygon
    
    // Error codes
    const EInvalidPosition: u64 = 0;
    const EInsufficientRewards: u64 = 1;
    const EUnauthorized: u64 = 2;
    const EInvalidChainId: u64 = 3;
    const EInvalidAmount: u64 = 4;
    
    // Structs
    struct RewardDistributorRegistry has key {
        id: UID,
        admin: address,
        ethereum_receiver: ExternalAddress,
        polygon_receiver: ExternalAddress,
        fee_percentage: u64, // Fee percentage in basis points (e.g., 50 = 0.5%)
        fee_collector: address,
    }
    
    // Events
    struct RewardsBridged has copy, drop {
        loan_id: String,
        owner: address,
        amount: u64,
        destination_chain: u16,
        destination_address: ExternalAddress,
        timestamp: u64,
        wormhole_sequence: u64,
    }
    
    struct FeesCollected has copy, drop {
        amount: u64,
        collector: address,
        timestamp: u64,
    }
    
    // Initialization function
    fun init(ctx: &mut TxContext) {
        // Create registry with default receiver addresses
        // In production, these would be the actual Ethereum/Polygon contract addresses
        let ethereum_receiver = external_address::new(x"da3bD1fE1973470312db04551B65f401Bc8a92fD");
        let polygon_receiver = external_address::new(x"da3bD1fE1973470312db04551B65f401Bc8a92fD");
        
        let registry = RewardDistributorRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            ethereum_receiver,
            polygon_receiver,
            fee_percentage: 50, // 0.5% fee
            fee_collector: tx_context::sender(ctx),
        };
        
        transfer::share_object(registry);
    }
    
    // Bridge rewards back to Ethereum/Polygon
    public entry fun bridge_rewards(
        registry: &RewardDistributorRegistry,
        wormhole_state: &mut WormholeState,
        position: &mut StakingPosition,
        destination_chain_id: u16,
        destination_address: vector<u8>,
        sui_payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify destination chain
        assert!(destination_chain_id == ETHEREUM_CHAIN_ID || destination_chain_id == POLYGON_CHAIN_ID, EInvalidChainId);
        
        // Get position details
        let (loan_id, owner, _, _, accumulated_rewards, is_active) = stake_module::get_position_details(position);
        
        // Verify position is active and has rewards
        assert!(is_active, EInvalidPosition);
        assert!(accumulated_rewards > 0, EInsufficientRewards);
        
        // Verify caller is the owner
        assert!(tx_context::sender(ctx) == owner, EUnauthorized);
        
        // Calculate fee
        let fee_amount = (accumulated_rewards * registry.fee_percentage) / 10000;
        let reward_amount = accumulated_rewards - fee_amount;
        
        // Create payload for Wormhole message
        // Format: [loan_id (32 bytes)][owner (32 bytes)][reward_amount (32 bytes)]
        let payload = vector::empty<u8>();
        
        // Add loan_id (padded to 32 bytes)
        let loan_id_bytes = string::bytes(&loan_id);
        let padding_needed = 32 - vector::length(&loan_id_bytes);
        let i = 0;
        while (i < padding_needed) {
            vector::push_back(&mut payload, 0);
            i = i + 1;
        };
        vector::append(&mut payload, loan_id_bytes);
        
        // Add owner address (padded to 32 bytes)
        let owner_bytes = address::to_bytes(owner);
        let padding_needed = 32 - vector::length(&owner_bytes);
        let i = 0;
        while (i < padding_needed) {
            vector::push_back(&mut payload, 0);
            i = i + 1;
        };
        vector::append(&mut payload, owner_bytes);
        
        // Add reward amount (padded to 32 bytes)
        let mut i = 0;
        while (i < 24) { // 32 - 8 = 24 bytes of padding for u64
            vector::push_back(&mut payload, 0);
            i = i + 1;
        };
        
        // Add reward amount as big-endian bytes
        let mut amount_temp = reward_amount;
        let mut amount_bytes = vector::empty<u8>();
        let mut i = 0;
        while (i < 8) {
            vector::push_back(&mut amount_bytes, ((amount_temp >> (8 * (7 - i))) & 0xFF) as u8);
            i = i + 1;
        };
        vector::append(&mut payload, amount_bytes);
        
        // Get destination address
        let destination_external_address = external_address::new(destination_address);
        
        // Determine receiver contract based on destination chain
        let receiver = if (destination_chain_id == ETHEREUM_CHAIN_ID) {
            registry.ethereum_receiver
        } else {
            registry.polygon_receiver
        };
        
        // Publish message to Wormhole
        let wormhole_fee = publish_message::fee(wormhole_state);
        assert!(coin::value(&sui_payment) >= wormhole_fee, EInvalidAmount);
        
        let sequence = publish_message::publish_message(
            wormhole_state,
            sui_payment,
            0, // Nonce
            payload,
            wormhole::vaa::PAYLOAD_ID_TRANSFER,
            ctx
        );
        
        // Reset accumulated rewards
        stake_module::reset_rewards(position);
        
        // Transfer fee to fee collector
        if (fee_amount > 0) {
            let fee_coin = coin::from_balance(balance::create_for_testing(fee_amount), ctx);
            transfer::public_transfer(fee_coin, registry.fee_collector);
            
            // Emit fee collection event
            event::emit(FeesCollected {
                amount: fee_amount,
                collector: registry.fee_collector,
                timestamp: clock::timestamp_ms(clock),
            });
        };
        
        // Emit event
        event::emit(RewardsBridged {
            loan_id,
            owner,
            amount: reward_amount,
            destination_chain: destination_chain_id,
            destination_address: destination_external_address,
            timestamp: clock::timestamp_ms(clock),
            wormhole_sequence: sequence,
        });
    }
    
    // Update fee percentage (admin only)
    public entry fun update_fee_percentage(
        registry: &mut RewardDistributorRegistry,
        new_percentage: u64,
        ctx: &mut TxContext
    ) {
        // Verify caller is admin
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        
        // Update fee percentage (max 5%)
        assert!(new_percentage <= 500, EInvalidAmount);
        registry.fee_percentage = new_percentage;
    }
    
    // Update fee collector (admin only)
    public entry fun update_fee_collector(
        registry: &mut RewardDistributorRegistry,
        new_collector: address,
        ctx: &mut TxContext
    ) {
        // Verify caller is admin
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        
        // Update fee collector
        registry.fee_collector = new_collector;
    }
    
    // Update destination receivers (admin only)
    public entry fun update_receivers(
        registry: &mut RewardDistributorRegistry,
        ethereum_receiver: vector<u8>,
        polygon_receiver: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify caller is admin
        assert!(tx_context::sender(ctx) == registry.admin, EUnauthorized);
        
        // Update receivers
        registry.ethereum_receiver = external_address::new(ethereum_receiver);
        registry.polygon_receiver = external_address::new(polygon_receiver);
    }
}