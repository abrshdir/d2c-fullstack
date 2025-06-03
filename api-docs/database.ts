import { Pool } from 'pg';
import {
  User,
  Loan,
  StakingPosition,
  DbTransaction,
  Reward,
  LoanStatus,
  StakingStatus,
  TransactionType,
  TransactionStatus
} from './types';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432'),
    });
  }

  // User operations
  async createUser(ethereumAddress: string, suiAddress: string): Promise<User> {
    const result = await this.pool.query(
      'INSERT INTO users (ethereum_address, sui_address) VALUES ($1, $2) RETURNING *',
      [ethereumAddress, suiAddress]
    );
    return this.mapUser(result.rows[0]);
  }

  async getUserByEthereumAddress(ethereumAddress: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE ethereum_address = $1',
      [ethereumAddress]
    );
    return result.rows[0] ? this.mapUser(result.rows[0]) : null;
  }

  // Loan operations
  async createLoan(
    userId: number,
    amount: string,
    tokenAddress: string
  ): Promise<Loan> {
    const result = await this.pool.query(
      'INSERT INTO loans (user_id, amount, token_address) VALUES ($1, $2, $3) RETURNING *',
      [userId, amount, tokenAddress]
    );
    return this.mapLoan(result.rows[0]);
  }

  async updateLoanStatus(
    loanId: number,
    status: LoanStatus,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<Loan> {
    const result = await this.pool.query(
      'UPDATE loans SET status = $1, ethereum_tx_hash = COALESCE($2, ethereum_tx_hash), sui_tx_hash = COALESCE($3, sui_tx_hash) WHERE id = $4 RETURNING *',
      [status, ethereumTxHash, suiTxHash, loanId]
    );
    return this.mapLoan(result.rows[0]);
  }

  async getLoanById(loanId: number): Promise<Loan | null> {
    const result = await this.pool.query(
      'SELECT * FROM loans WHERE id = $1',
      [loanId]
    );
    return result.rows[0] ? this.mapLoan(result.rows[0]) : null;
  }

  // Staking position operations
  async createStakingPosition(
    loanId: number,
    stakedAmount: string
  ): Promise<StakingPosition> {
    const result = await this.pool.query(
      'INSERT INTO staking_positions (loan_id, staked_amount) VALUES ($1, $2) RETURNING *',
      [loanId, stakedAmount]
    );
    return this.mapStakingPosition(result.rows[0]);
  }

  async updateStakingPosition(
    positionId: number,
    status: StakingStatus,
    rewardsAccrued: string
  ): Promise<StakingPosition> {
    const result = await this.pool.query(
      'UPDATE staking_positions SET status = $1, rewards_accrued = $2, last_update_timestamp = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, rewardsAccrued, positionId]
    );
    return this.mapStakingPosition(result.rows[0]);
  }

  async getStakingPositionByLoanId(loanId: number): Promise<StakingPosition | null> {
    const result = await this.pool.query(
      'SELECT * FROM staking_positions WHERE loan_id = $1',
      [loanId]
    );
    return result.rows[0] ? this.mapStakingPosition(result.rows[0]) : null;
  }

  // Transaction operations
  async createTransaction(
    userId: number,
    loanId: number,
    type: TransactionType,
    amount: string,
    tokenAddress: string,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<DbTransaction> {
    const result = await this.pool.query(
      'INSERT INTO transactions (user_id, loan_id, type, amount, token_address, ethereum_tx_hash, sui_tx_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, loanId, type, amount, tokenAddress, ethereumTxHash, suiTxHash]
    );
    return this.mapTransaction(result.rows[0]);
  }

  async updateTransactionStatus(
    transactionId: number,
    status: TransactionStatus,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<DbTransaction> {
    const result = await this.pool.query(
      'UPDATE transactions SET status = $1, ethereum_tx_hash = COALESCE($2, ethereum_tx_hash), sui_tx_hash = COALESCE($3, sui_tx_hash) WHERE id = $4 RETURNING *',
      [status, ethereumTxHash, suiTxHash, transactionId]
    );
    return this.mapTransaction(result.rows[0]);
  }

  async getTransactionHistory(
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<DbTransaction[]> {
    const offset = (page - 1) * limit;
    const result = await this.pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return result.rows.map(this.mapTransaction);
  }

  // Reward operations
  async createReward(
    stakingPositionId: number,
    amount: string,
    tokenAddress: string,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<Reward> {
    const result = await this.pool.query(
      'INSERT INTO rewards (staking_position_id, amount, token_address, ethereum_tx_hash, sui_tx_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [stakingPositionId, amount, tokenAddress, ethereumTxHash, suiTxHash]
    );
    return this.mapReward(result.rows[0]);
  }

  // Helper mapping functions
  private mapUser(row: any): User {
    return {
      id: row.id,
      ethereumAddress: row.ethereum_address,
      suiAddress: row.sui_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapLoan(row: any): Loan {
    return {
      id: row.id,
      userId: row.user_id,
      amount: row.amount,
      tokenAddress: row.token_address,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ethereumTxHash: row.ethereum_tx_hash,
      suiTxHash: row.sui_tx_hash,
    };
  }

  private mapStakingPosition(row: any): StakingPosition {
    return {
      id: row.id,
      loanId: row.loan_id,
      status: row.status,
      stakedAmount: row.staked_amount,
      rewardsAccrued: row.rewards_accrued,
      lastUpdateTimestamp: row.last_update_timestamp,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTransaction(row: any): DbTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      loanId: row.loan_id,
      type: row.type,
      status: row.status,
      amount: row.amount,
      tokenAddress: row.token_address,
      ethereumTxHash: row.ethereum_tx_hash,
      suiTxHash: row.sui_tx_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapReward(row: any): Reward {
    return {
      id: row.id,
      stakingPositionId: row.staking_position_id,
      amount: row.amount,
      tokenAddress: row.token_address,
      timestamp: row.timestamp,
      ethereumTxHash: row.ethereum_tx_hash,
      suiTxHash: row.sui_tx_hash,
    };
  }
} 