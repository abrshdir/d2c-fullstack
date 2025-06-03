import mongoose from 'mongoose';
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
import {
  User as UserModel,
  Loan as LoanModel,
  StakingPosition as StakingPositionModel,
  Transaction as TransactionModel,
  Reward as RewardModel,
  IUser,
  ILoan,
  IStakingPosition,
  ITransaction,
  IReward
} from './models';

export class DatabaseService {
  constructor() {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sui_staking')
      .then(() => console.log('Connected to MongoDB'))
      .catch(err => console.error('MongoDB connection error:', err));
  }

  // User operations
  async createUser(ethereumAddress: string, suiAddress: string): Promise<User> {
    const user = await UserModel.create({ ethereumAddress, suiAddress });
    return this.mapUser(user);
  }

  async getUserByEthereumAddress(ethereumAddress: string): Promise<User | null> {
    const user = await UserModel.findOne({ ethereumAddress });
    return user ? this.mapUser(user) : null;
  }

  // Loan operations
  async createLoan(
    userId: string,
    amount: string,
    tokenAddress: string
  ): Promise<Loan> {
    const loan = await LoanModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      amount,
      tokenAddress,
      status: 'PENDING'
    });
    return this.mapLoan(loan);
  }

  async updateLoanStatus(
    loanId: string,
    status: LoanStatus,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<Loan> {
    const loan = await LoanModel.findByIdAndUpdate(
      loanId,
      {
        status,
        ...(ethereumTxHash && { ethereumTxHash }),
        ...(suiTxHash && { suiTxHash })
      },
      { new: true }
    );
    if (!loan) throw new Error('Loan not found');
    return this.mapLoan(loan);
  }

  async getLoanById(loanId: string): Promise<Loan | null> {
    const loan = await LoanModel.findById(loanId);
    return loan ? this.mapLoan(loan) : null;
  }

  // Staking position operations
  async createStakingPosition(
    loanId: string,
    stakedAmount: string
  ): Promise<StakingPosition> {
    const position = await StakingPositionModel.create({
      loanId: new mongoose.Types.ObjectId(loanId),
      stakedAmount,
      status: 'PENDING',
      rewardsAccrued: '0'
    });
    return this.mapStakingPosition(position);
  }

  async updateStakingPosition(
    positionId: string,
    status: StakingStatus,
    rewardsAccrued: string
  ): Promise<StakingPosition> {
    const position = await StakingPositionModel.findByIdAndUpdate(
      positionId,
      {
        status,
        rewardsAccrued,
        lastUpdateTimestamp: new Date()
      },
      { new: true }
    );
    if (!position) throw new Error('Staking position not found');
    return this.mapStakingPosition(position);
  }

  async getStakingPositionByLoanId(loanId: string): Promise<StakingPosition | null> {
    const position = await StakingPositionModel.findOne({ loanId: new mongoose.Types.ObjectId(loanId) });
    return position ? this.mapStakingPosition(position) : null;
  }

  // Transaction operations
  async createTransaction(
    userId: string,
    loanId: string,
    type: TransactionType,
    amount: string,
    tokenAddress: string,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<DbTransaction> {
    const transaction = await TransactionModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      loanId: new mongoose.Types.ObjectId(loanId),
      type,
      amount,
      tokenAddress,
      status: 'PENDING',
      ethereumTxHash,
      suiTxHash
    });
    return this.mapTransaction(transaction);
  }

  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<DbTransaction> {
    const transaction = await TransactionModel.findByIdAndUpdate(
      transactionId,
      {
        status,
        ...(ethereumTxHash && { ethereumTxHash }),
        ...(suiTxHash && { suiTxHash })
      },
      { new: true }
    );
    if (!transaction) throw new Error('Transaction not found');
    return this.mapTransaction(transaction);
  }

  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<DbTransaction[]> {
    const transactions = await TransactionModel.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return transactions.map(this.mapTransaction);
  }

  // Reward operations
  async createReward(
    stakingPositionId: string,
    amount: string,
    tokenAddress: string,
    ethereumTxHash?: string,
    suiTxHash?: string
  ): Promise<Reward> {
    const reward = await RewardModel.create({
      stakingPositionId: new mongoose.Types.ObjectId(stakingPositionId),
      amount,
      tokenAddress,
      ethereumTxHash,
      suiTxHash
    });
    return this.mapReward(reward);
  }

  // Helper mapping functions
  private mapUser(doc: IUser): User {
    return {
      id: doc._id.toString(),
      ethereumAddress: doc.ethereumAddress,
      suiAddress: doc.suiAddress,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private mapLoan(doc: ILoan): Loan {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      amount: doc.amount,
      tokenAddress: doc.tokenAddress,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      ethereumTxHash: doc.ethereumTxHash,
      suiTxHash: doc.suiTxHash,
    };
  }

  private mapStakingPosition(doc: IStakingPosition): StakingPosition {
    return {
      id: doc._id.toString(),
      loanId: doc.loanId.toString(),
      status: doc.status,
      stakedAmount: doc.stakedAmount,
      rewardsAccrued: doc.rewardsAccrued,
      lastUpdateTimestamp: doc.lastUpdateTimestamp,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private mapTransaction(doc: ITransaction): DbTransaction {
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      loanId: doc.loanId.toString(),
      type: doc.type,
      status: doc.status,
      amount: doc.amount,
      tokenAddress: doc.tokenAddress,
      ethereumTxHash: doc.ethereumTxHash,
      suiTxHash: doc.suiTxHash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private mapReward(doc: IReward): Reward {
    return {
      id: doc._id.toString(),
      stakingPositionId: doc.stakingPositionId.toString(),
      amount: doc.amount,
      tokenAddress: doc.tokenAddress,
      timestamp: doc.timestamp,
      ethereumTxHash: doc.ethereumTxHash,
      suiTxHash: doc.suiTxHash,
    };
  }
} 