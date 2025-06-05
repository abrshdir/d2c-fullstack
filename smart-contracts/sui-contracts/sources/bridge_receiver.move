module dust2cash_staking::bridge_receiver {
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
    
    // Import our staking module
    use dust2cash_staking::stake_module;
    
    // Constants
    const ETHEREUM_CHAIN_ID: u16 = 2; // Wormhole chain ID for Ethereum
    const POLYGON_CHAIN_ID: u16 = 5; // Wormhole chain ID for Polygon
    
    // Error codes
    const EInvalidVAA: u64 = 0;
    const EInvalidSourceChain: u64 = 1;
    const EInvalidEmitter: u64 = 2;
    const EInvalidPayload: u64 = 3;
    const EInvalidAmount: u64 = 4;
    const EInvalidLoanId: u64 = 5;
    const EUnauthorized: u64 = 6;
    
    // Structs
    struct BridgeRegistry has key {
        id: UID,
        admin: address,
        ethereum_emitter: ExternalAddress,
        polygon_emitter: ExternalAddress,
    }
    
    // Events
    struct BridgeReceived has copy, drop {
        loan_id: String,
        owner: address,
        amount: u64,
        source_chain: u16,
        source_address: ExternalAddress,
        timestamp: u64,
    }
    
    // Initialization function
    fun init(ctx: &mut TxContext) {
        // Create registry with default emitter addresses
        // In production, these would be the actual Wormhole token bridge contracts
        let ethereum_emitter = external_address::new(x"3ee18B2214AFF97000D974cf647E7C347E8fa585");
        let polygon_emitter = external_address::new(x"5a58505a96D1dbf8dF91cB21B54419FC36e93fdE");
        
        let registry = BridgeRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            ethereum_emitter,
            polygon_emitter,
        };
        
        transfer::share_object(registry);
    }
    
    // Process a Wormhole VAA containing bridge information
    public entry fun process_bridge_vaa(
        registry: &BridgeRegistry,
        wormhole_state: &WormholeState,
        vaa_bytes: vector<u8>,
        sui_coin: Coin<SUI>,
        validator_address: address,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Parse and verify the VAA
        let parsed_vaa = vaa::parse_and_verify(wormhole_state, vaa_bytes);
        let vaa = vaa::destroy(parsed_vaa);
        
        // Verify the source chain is either Ethereum or Polygon
        let source_chain = vaa.emitter_chain;
        assert!(source_chain == ETHEREUM_CHAIN_ID || source_chain == POLYGON_CHAIN_ID, EInvalidSourceChain);
        
        // Verify the emitter address matches our expected token bridge contract
        let emitter_address = vaa.emitter_address;
        if (source_chain == ETHEREUM_CHAIN_ID) {
            assert!(external_address::eq(&emitter_address, &registry.ethereum_emitter), EInvalidEmitter);
        } else {
            assert!(external_address::eq(&emitter_address, &registry.polygon_emitter), EInvalidEmitter);
        };
        
        // Parse the payload
        let payload = vaa.payload;
        
        // The payload format should be:
        // [0:32] - loan_id (bytes32)
        // [32:64] - owner address (bytes32)
        // [64:96] - amount (uint256)
        assert!(vector::length(&payload) >= 96, EInvalidPayload);
        
        // Extract loan_id (first 32 bytes)
        let loan_id_bytes = vector::empty<u8>();
        let i = 0;
        while (i < 32) {
            vector::push_back(&mut loan_id_bytes, *vector::borrow(&payload, i));
            i = i + 1;
        };
        
        // Convert loan_id to string
        let loan_id = bytes32_to_string(loan_id_bytes);
        
        // Extract owner address (next 32 bytes)
        let owner_bytes = vector::empty<u8>();
        let i = 32;
        while (i < 64) {
            vector::push_back(&mut owner_bytes, *vector::borrow(&payload, i));
            i = i + 1;
        };
        
        // Convert owner bytes to Sui address
        let owner = bytes_to_address(owner_bytes);
        
        // Extract amount (next 32 bytes)
        let amount_bytes = vector::empty<u8>();
        let i = 64;
        while (i < 96) {
            vector::push_back(&mut amount_bytes, *vector::borrow(&payload, i));
            i = i + 1;
        };
        
        // Convert amount bytes to u64
        let amount = bytes_to_u64(amount_bytes);
        
        // Verify the SUI coin amount matches the bridged amount
        assert!(coin::value(&sui_coin) == amount, EInvalidAmount);
        
        // Create staking position
        stake_module::create_position(
            stake_module::get_registry(),
            vector::bytes(loan_id),
            owner,
            sui_coin,
            validator_address,
            clock,
            ctx
        );
        
        // Emit event
        event::emit(BridgeReceived {
            loan_id,
            owner,
            amount,
            source_chain,
            source_address: emitter_address,
            timestamp: clock::timestamp_ms(clock),
        });
    }
    
    // Helper function to convert bytes32 to string
    fun bytes32_to_string(bytes: vector<u8>): String {
        // Remove leading zeros
        let start = 0;
        while (start < vector::length(&bytes) && *vector::borrow(&bytes, start) == 0) {
            start = start + 1;
        };
        
        // If all zeros, return empty string
        if (start == vector::length(&bytes)) {
            return string::utf8(vector::empty<u8>())
        };
        
        // Extract non-zero part
        let result = vector::empty<u8>();
        let i = start;
        while (i < vector::length(&bytes)) {
            vector::push_back(&mut result, *vector::borrow(&bytes, i));
            i = i + 1;
        };
        
        string::utf8(result)
    }
    
    // Helper function to convert bytes to address
    fun bytes_to_address(bytes: vector<u8>): address {
        // Take the last 20 bytes (Ethereum address size) and convert to Sui address
        let addr_bytes = vector::empty<u8>();
        let len = vector::length(&bytes);
        let start = if (len > 20) { len - 20 } else { 0 };
        
        let i = start;
        while (i < len) {
            vector::push_back(&mut addr_bytes, *vector::borrow(&bytes, i));
            i = i + 1;
        };
        
        // Pad to 32 bytes if needed
        while (vector::length(&addr_bytes) < 32) {
            vector::push_back(&mut addr_bytes, 0);
        };
        
        address::from_bytes(addr_bytes)
    }
    
    // Helper function to convert bytes to u64
    fun bytes_to_u64(bytes: vector<u8>): u64 {
        let result: u64 = 0;
        let i = 0;
        let len = vector::length(&bytes);
        let start = if (len > 8) { len - 8 } else { 0 };
        
        let i = start;
        while (i < len) {
            result = (result << 8) + (*vector::borrow(&bytes, i) as u64);
            i = i + 1;
        };
        
        result
    }
}