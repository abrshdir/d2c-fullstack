module dust2cash_staking::stake_module {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::clock::{Self, Clock};
    use sui::address;
    use std::string::{Self, String};
    use std::vector;
    
    // Constants
    const MIN_STAKE_PERIOD: u64 = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const REWARD_RATE_PER_DAY: u64 = 5; // 0.05% daily reward rate (5 basis points)
    
    // Error codes
    const EInvalidLoanId: u64 = 0;
    const EInvalidAmount: u64 = 1;
    const EInsufficientBalance: u64 = 2;
    const EStakingPositionNotFound: u64 = 3;
    const EStakingPeriodNotMet: u64 = 4;
    const EUnauthorized: u64 = 5;
    const EInvalidValidator: u64 = 6;
    const EInvalidBridgeMessage: u64 = 7;
    
    // Structs
    struct StakingPosition has key, store {
        id: UID,
        loan_id: String,
        owner: address,
        staked_amount: u64,
        validator_address: address,
        start_time: u64,
        last_reward_calculation: u64,
        accumulated_rewards: u64,
        is_active: bool,
    }
    
    struct StakingRegistry has key {
        id: UID,
        positions: Table<String, ID>,
        admin: address,
        treasury_balance: Balance<SUI>,
    }
    
    // Events
    struct CollateralLocked has copy, drop {
        loan_id: String,
        owner: address,
        amount: u64,
        validator_address: address,
        timestamp: u64,
    }
    
    struct RewardsAccrued has copy, drop {
        loan_id: String,
        owner: address,
        reward_amount: u64,
        timestamp: u64,
    }
    
    struct PositionClosed has copy, drop {
        loan_id: String,
        owner: address,
        collateral_amount: u64,
        reward_amount: u64,
        timestamp: u64,
    }
    
    // Initialization function - creates the registry
    fun init(ctx: &mut TxContext) {
        let registry = StakingRegistry {
            id: object::new(ctx),
            positions: table::new(ctx),
            admin: tx_context::sender(ctx),
            treasury_balance: balance::zero(),
        };
        
        transfer::share_object(registry);
    }
    
    // Create a new staking position
    public entry fun create_position(
        registry: &mut StakingRegistry,
        loan_id: vector<u8>,
        owner: address,
        sui_coin: Coin<SUI>,
        validator_address: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let loan_id_str = string::utf8(loan_id);
        let amount = coin::value(&sui_coin);
        
        assert!(amount > 0, EInvalidAmount);
        assert!(!table::contains(&registry.positions, loan_id_str), EInvalidLoanId);
        
        // Take the SUI from the coin and add to position
        let sui_balance = coin::into_balance(sui_coin);
        
        // Create staking position
        let current_time = clock::timestamp_ms(clock);
        let position = StakingPosition {
            id: object::new(ctx),
            loan_id: loan_id_str,
            owner,
            staked_amount: amount,
            validator_address,
            start_time: current_time,
            last_reward_calculation: current_time,
            accumulated_rewards: 0,
            is_active: true,
        };
        
        // Add position to registry
        let position_id = object::id(&position);
        table::add(&mut registry.positions, loan_id_str, position_id);
        
        // Transfer position to shared object
        transfer::share_object(position);
        
        // Emit event
        event::emit(CollateralLocked {
            loan_id: loan_id_str,
            owner,
            amount,
            validator_address,
            timestamp: current_time,
        });
    }
    
    // Update rewards for a staking position
    public entry fun update_rewards(
        position: &mut StakingPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        let time_elapsed = current_time - position.last_reward_calculation;
        
        // Calculate rewards based on time elapsed (in days)
        let days_elapsed = time_elapsed / (24 * 60 * 60 * 1000);
        if (days_elapsed > 0) {
            let new_rewards = (position.staked_amount * days_elapsed * REWARD_RATE_PER_DAY) / 10000;
            position.accumulated_rewards = position.accumulated_rewards + new_rewards;
            position.last_reward_calculation = current_time;
            
            // Emit event
            event::emit(RewardsAccrued {
                loan_id: position.loan_id,
                owner: position.owner,
                reward_amount: new_rewards,
                timestamp: current_time,
            });
        };
    }
    
    // Close a staking position and return funds
    public entry fun close_position(
        registry: &mut StakingRegistry,
        position: &mut StakingPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        
        // Ensure minimum staking period is met
        assert!(current_time - position.start_time >= MIN_STAKE_PERIOD, EStakingPeriodNotMet);
        
        // Update rewards one last time
        let time_elapsed = current_time - position.last_reward_calculation;
        let days_elapsed = time_elapsed / (24 * 60 * 60 * 1000);
        if (days_elapsed > 0) {
            let new_rewards = (position.staked_amount * days_elapsed * REWARD_RATE_PER_DAY) / 10000;
            position.accumulated_rewards = position.accumulated_rewards + new_rewards;
        };
        
        // Mark position as inactive
        position.is_active = false;
        
        // Create coins for principal and rewards
        let principal_coin = coin::from_balance(balance::create_for_testing(position.staked_amount), ctx);
        let rewards_coin = coin::from_balance(balance::create_for_testing(position.accumulated_rewards), ctx);
        
        // Transfer coins back to owner
        transfer::public_transfer(principal_coin, position.owner);
        transfer::public_transfer(rewards_coin, position.owner);
        
        // Emit event
        event::emit(PositionClosed {
            loan_id: position.loan_id,
            owner: position.owner,
            collateral_amount: position.staked_amount,
            reward_amount: position.accumulated_rewards,
            timestamp: current_time,
        });
    }
    
    // Get staking position details
    public fun get_position_details(position: &StakingPosition): (String, address, u64, u64, u64, bool) {
        (
            position.loan_id,
            position.owner,
            position.staked_amount,
            position.start_time,
            position.accumulated_rewards,
            position.is_active
        )
    }
    
    // Check if a position exists
    public fun position_exists(registry: &StakingRegistry, loan_id: vector<u8>): bool {
        let loan_id_str = string::utf8(loan_id);
        table::contains(&registry.positions, loan_id_str)
    }
    
    // Get position ID by loan ID
    public fun get_position_id(registry: &StakingRegistry, loan_id: vector<u8>): ID {
        let loan_id_str = string::utf8(loan_id);
        assert!(table::contains(&registry.positions, loan_id_str), EStakingPositionNotFound);
        *table::borrow(&registry.positions, loan_id_str)
    }
}