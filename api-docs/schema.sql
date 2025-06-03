-- Create enum types
CREATE TYPE loan_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE staking_status AS ENUM ('PENDING', 'STAKED', 'REWARDING', 'COMPLETED');
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'SWAP', 'BRIDGE', 'STAKE', 'WITHDRAW');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    ethereum_address VARCHAR(42) UNIQUE NOT NULL,
    sui_address VARCHAR(66) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create loans table
CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount VARCHAR(78) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    status loan_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ethereum_tx_hash VARCHAR(66),
    sui_tx_hash VARCHAR(66)
);

-- Create staking_positions table
CREATE TABLE staking_positions (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id),
    status staking_status NOT NULL DEFAULT 'PENDING',
    staked_amount VARCHAR(78) NOT NULL,
    rewards_accrued VARCHAR(78) DEFAULT '0',
    last_update_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    loan_id INTEGER REFERENCES loans(id),
    type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'PENDING',
    amount VARCHAR(78) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    ethereum_tx_hash VARCHAR(66),
    sui_tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create rewards table
CREATE TABLE rewards (
    id SERIAL PRIMARY KEY,
    staking_position_id INTEGER REFERENCES staking_positions(id),
    amount VARCHAR(78) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ethereum_tx_hash VARCHAR(66),
    sui_tx_hash VARCHAR(66)
);

-- Create indexes
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_staking_positions_loan_id ON staking_positions(loan_id);
CREATE INDEX idx_staking_positions_status ON staking_positions(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_loan_id ON transactions(loan_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_rewards_staking_position_id ON rewards(staking_position_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staking_positions_updated_at
    BEFORE UPDATE ON staking_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 