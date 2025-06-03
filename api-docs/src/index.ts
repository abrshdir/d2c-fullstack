import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { DatabaseService } from './database';
import { GasLoanRequest, WithdrawRequest } from './types';

// Load environment variables
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize database service
const db = new DatabaseService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Load and serve Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'No token provided' });
  }

  try {
    // Verify JWT token
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ code: 'INVALID_TOKEN', message: 'Invalid token' });
  }
};

// Routes
app.post('/api/v1/gas-loan/process-swap', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { amount, tokenAddress, permit } = req.body as GasLoanRequest;
    const userId = (req as any).user.id;

    // Create loan record
    const loan = await db.createLoan(userId, amount, tokenAddress);

    // Create transaction record
    await db.createTransaction(
      userId,
      loan.id,
      'DEPOSIT',
      amount,
      tokenAddress
    );

    // TODO: Integrate with Developer 1's GasLoanService
    // const result = await gasLoanService.processPostSwap(loan.id, amount, tokenAddress, permit);

    res.json({
      loanId: loan.id.toString(),
      status: 'PENDING',
      estimatedGasCost: '0' // TODO: Get from GasLoanService
    });
  } catch (error) {
    console.error('Error processing gas loan:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to process gas loan',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

app.get('/api/v1/staking/status/:loanId', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { loanId } = req.params;
    const userId = (req as any).user.id;

    const loan = await db.getLoanById(parseInt(loanId));
    if (!loan || loan.userId !== userId) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Loan not found'
      });
    }

    const stakingPosition = await db.getStakingPositionByLoanId(loan.id);
    if (!stakingPosition) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Staking position not found'
      });
    }

    res.json({
      loanId: loan.id.toString(),
      status: stakingPosition.status,
      stakedAmount: stakingPosition.stakedAmount,
      rewardsAccrued: stakingPosition.rewardsAccrued,
      lastUpdateTimestamp: stakingPosition.lastUpdateTimestamp.toISOString()
    });
  } catch (error) {
    console.error('Error getting staking status:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get staking status',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

app.post('/api/v1/staking/withdraw', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { loanId } = req.body as WithdrawRequest;
    const userId = (req as any).user.id;

    const loan = await db.getLoanById(parseInt(loanId));
    if (!loan || loan.userId !== userId) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Loan not found'
      });
    }

    const stakingPosition = await db.getStakingPositionByLoanId(loan.id);
    if (!stakingPosition) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Staking position not found'
      });
    }

    // TODO: Integrate with Developer 1's withdrawal service
    // const result = await withdrawalService.initiateWithdrawal(loan.id);

    res.json({
      transactionHash: '0x...', // TODO: Get from withdrawal service
      status: 'PENDING',
      amount: stakingPosition.stakedAmount,
      rewards: stakingPosition.rewardsAccrued
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to process withdrawal',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

app.get('/api/v1/transactions/history', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const transactions = await db.getTransactionHistory(userId, page, limit);

    res.json({
      transactions: transactions.map(tx => ({
        id: tx.id.toString(),
        type: tx.type,
        status: tx.status,
        amount: tx.amount,
        timestamp: tx.createdAt.toISOString(),
        transactionHash: tx.ethereumTxHash || tx.suiTxHash
      }))
    });
  } catch (error) {
    console.error('Error getting transaction history:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get transaction history',
      details: error instanceof Error ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 