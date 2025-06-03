"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AccountStatusResponse } from "@/lib/api/tokenScanner";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { DUST2CASH_ESCROW_CONTRACT_ADDRESS, DUST2CASH_ESCROW_ABI } from "@/lib/contracts/Dust2CashEscrow";
import { parseUnits, formatUnits } from "ethers"; // Using ethers v6 style imports

interface RepayLoanFormProps {
  accountStatus: AccountStatusResponse | null;
  onRepaymentSuccess?: () => void; // Callback to refresh data
}

export function RepayLoanForm({ accountStatus, onRepaymentSuccess }: RepayLoanFormProps) {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [repaymentAmount, setRepaymentAmount] = useState("");

  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess, error: txError } = useWaitForTransactionReceipt({ hash });

  const outstandingDebt = accountStatus ? parseFloat(accountStatus.outstandingDebt) : 0;
  const canRepay = isConnected && outstandingDebt > 0;

  const handleRepay = async () => {
    if (!isConnected || !address) {
      toast({ title: "Error", description: "Please connect your wallet.", variant: "destructive" });
      return;
    }
    if (!accountStatus || outstandingDebt <= 0) {
      toast({ title: "Error", description: "No outstanding debt to repay.", variant: "destructive" });
      return;
    }

    const amountToRepay = parseFloat(repaymentAmount);
    if (isNaN(amountToRepay) || amountToRepay <= 0) {
      toast({ title: "Error", description: "Please enter a valid repayment amount.", variant: "destructive" });
      return;
    }
    if (amountToRepay > outstandingDebt) {
      toast({ title: "Error", description: "Repayment amount cannot exceed outstanding debt.", variant: "destructive" });
      return;
    }

    try {
      const amountInSmallestUnit = parseUnits(repaymentAmount, 6); // Assuming USDC has 6 decimals

      console.log(`Initiating repayment of ${repaymentAmount} USDC to Dust2CashEscrow contract...`);
      writeContract({
        address: DUST2CASH_ESCROW_CONTRACT_ADDRESS as `0x${string}`,
        abi: DUST2CASH_ESCROW_ABI,
        functionName: 'repayGasLoan',
        args: [amountInSmallestUnit],
      });
    } catch (e) {
      console.error("Error preparing repayment transaction:", e);
      toast({ title: "Error", description: `Error preparing transaction: ${e instanceof Error ? e.message : "Unknown error"}`, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (isTxSuccess) {
      toast({
        title: "Repayment Successful",
        description: `Successfully repaid funds. Transaction: ${hash}`,
      });
      setRepaymentAmount(""); // Clear input
      if (onRepaymentSuccess) {
        onRepaymentSuccess(); // Callback to parent to refresh data
      }
    }
    if (writeError) {
      toast({
        title: "Repayment Error",
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
  }, [isTxSuccess, writeError, txError, hash, toast, onRepaymentSuccess]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repay Gas Loan</CardTitle>
        <CardDescription>
          Repay your outstanding gas loan debt to the Dust2Cash Escrow contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && accountStatus ? (
          <>
            <p>Outstanding Debt: <strong>{accountStatus.outstandingDebt} USDC</strong></p>
            {outstandingDebt > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="repaymentAmount">Amount to Repay (USDC)</Label>
                <Input
                  id="repaymentAmount"
                  type="number"
                  placeholder={`Max ${accountStatus.outstandingDebt}`}
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  max={accountStatus.outstandingDebt}
                  step="any"
                />
              </div>
            ) : (
              <p className="text-green-500">You have no outstanding debt!</p>
            )}
            <Button
              onClick={handleRepay}
              disabled={!canRepay || isWritePending || isTxLoading || !repaymentAmount || parseFloat(repaymentAmount) <= 0}
              className="w-full"
            >
              {isWritePending && "Check Wallet..."}
              {isTxLoading && "Processing Repayment..."}
              {!isWritePending && !isTxLoading && "Repay Loan"}
            </Button>
          </>
        ) : (
          <p>{isConnected ? "Loading account status..." : "Please connect your wallet to manage your loan."}</p>
        )}
        {hash && <p className="text-sm text-muted-foreground">Tx hash: {hash}</p>}
      </CardContent>
    </Card>
  );
}
