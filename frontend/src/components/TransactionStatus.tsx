import React from 'react';
import { Loader2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { TransactionStatus as TxStatus } from '@/lib/api/swapExecutionService';

interface TransactionStatusProps {
  status: TxStatus | null;
  txHash?: string | null;
  error?: string | null;
  fromAmount?: string;
  toAmount?: string;
  fromSymbol?: string;
  toSymbol?: string;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  status,
  txHash,
  error,
  fromAmount,
  toAmount,
  fromSymbol,
  toSymbol
}) => {
  if (!status) return null;

  const getStatusColor = () => {
    switch (status) {
      case TxStatus.SUCCESS:
        return 'bg-green-50 border border-green-200';
      case TxStatus.FAILED:
        return 'bg-red-50 border border-red-200';
      default:
        return 'bg-blue-50 border border-blue-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case TxStatus.SUCCESS:
        return <Check className="h-5 w-5 text-green-500" />;
      case TxStatus.FAILED:
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case TxStatus.SUCCESS:
        return 'Transaction Successful';
      case TxStatus.FAILED:
        return 'Transaction Failed';
      case TxStatus.PENDING:
        return 'Transaction Pending';
      default:
        return 'Processing Transaction';
    }
  };

  return (
    <div className={`p-4 rounded-lg ${getStatusColor()} mb-4`}>
      <div className="flex items-center mb-2">
        <span className="mr-2">{getStatusIcon()}</span>
        <h3 className="font-medium">{getStatusText()}</h3>
      </div>
      
      {(status === TxStatus.SUCCESS && fromAmount && toAmount) && (
        <div className="text-sm mb-2">
          <p>Successfully swapped {fromAmount} {fromSymbol} for {toAmount} {toSymbol}</p>
        </div>
      )}
      
      {error && status === TxStatus.FAILED && (
        <div className="text-sm text-red-600 mb-2">
          <p>{error}</p>
        </div>
      )}
      
      {txHash && (
        <div className="flex items-center text-xs text-gray-500 mt-2">
          <span className="mr-1">View on Explorer:</span>
          <a 
            href={`https://sepolia.etherscan.io/tx/${txHash}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline flex items-center"
          >
            {txHash.substring(0, 8)}...{txHash.substring(txHash.length - 6)}
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>
      )}
    </div>
  );
};
