"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Input and Label might not be needed if we just display info and a button
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
// initiateWithdrawal and WithdrawRequest are from the old system, remove.
// import { initiateWithdrawal } from "@/lib/api/api";
// import { WithdrawRequest } from "@/lib/api/types";
import { AccountStatusResponse } from "@/lib/api/tokenScanner"; // For prop type
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { DUST2CASH_ESCROW_CONTRACT_ADDRESS, DUST2CASH_ESCROW_ABI } from "@/lib/contracts/Dust2CashEscrow"; // Placeholder for now
import { parseUnits, formatUnits } from "ethers";


interface WithdrawFormProps {
  accountStatus: AccountStatusResponse | null;
  onWithdrawalInitiated?: () => void; // Callback to refresh data
}

export function WithdrawForm({ accountStatus, onWithdrawalInitiated }: WithdrawFormProps) {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess, error: txError } = useWaitForTransactionReceipt({ hash });

  const canWithdraw = accountStatus && parseFloat(accountStatus.outstandingDebt) === 0 && parseFloat(accountStatus.escrowedAmount) > 0;

  const handleWithdraw = async () => {
    if (!isConnected || !address) {
      toast({ title: "Error", description: "Please connect your wallet.", variant: "destructive" });
      return;
    }
    if (!canWithdraw || !accountStatus) {
      toast({ title: "Error", description: "Withdrawal conditions not met.", variant: "destructive" });
      return;
    }

    console.log("Initiating withdrawal from Dust2CashEscrow contract...");
    writeContract({
      address: DUST2CASH_ESCROW_CONTRACT_ADDRESS as `0x${string}`,
      abi: DUST2CASH_ESCROW_ABI,
      functionName: 'withdrawFunds',
      args: [], // withdrawFunds takes no arguments
    });
  };

  useEffect(() => {
    if (isTxSuccess) {
      toast({
        title: "Withdrawal Successful",
        description: `Funds withdrawn successfully. Transaction: ${hash}`,
      });
      if (onWithdrawalInitiated) {
        onWithdrawalInitiated(); // Callback to parent to refresh data
      }
    }
    if (writeError) {
      toast({
        title: "Withdrawal Error",
        description: `Failed to send transaction: ${writeError.shortMessage || writeError.message}`,
        variant: "destructive",
      });
    }
    if (txError) {
      toast({
        title: "Transaction Error",
        description: `Transaction failed: ${txError.shortMessage || txError.message}`,
        variant: "destructive",
      });
    }
  }, [isTxSuccess, writeError, txError, hash, toast, onWithdrawalInitiated]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw Your USDC</CardTitle>
        <CardDescription>
          Withdraw your USDC from the Dust2Cash Escrow contract.
          Your outstanding gas loan debt must be zero.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && accountStatus ? (
          <>
            <p>Escrowed Amount: <strong>{accountStatus.escrowedAmount} USDC</strong></p>
            <p>Outstanding Debt: <strong>{accountStatus.outstandingDebt} USDC</strong></p>
            {parseFloat(accountStatus.outstandingDebt) > 0 && (
              <p className="text-red-500">You must repay your outstanding debt before withdrawing.</p>
            )}
            <Button
              onClick={handleWithdraw}
              disabled={!canWithdraw || isWritePending || isTxLoading}
              className="w-full"
            >
              {isWritePending && "Check Wallet..."}
              {isTxLoading && "Processing Transaction..."}
              {!isWritePending && !isTxLoading && "Withdraw Escrowed USDC"}
            </Button>
          </>
        ) : (
          <p>{isConnected ? "Loading account status..." : "Please connect your wallet to see withdrawal options."}</p>
        )}
        {hash && <p className="text-sm text-muted-foreground">Tx hash: {hash}</p>}
      </CardContent>
    </Card>
  );
}