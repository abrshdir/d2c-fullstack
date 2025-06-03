"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { initiateWithdrawal } from "@/lib/api/api";
import { WithdrawRequest } from "@/lib/api/types";

export function WithdrawForm() {
  const [loanId, setLoanId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId) {
      toast({
        title: "Error",
        description: "Please enter a loan ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const request: WithdrawRequest = {
        loanId,
      };

      const response = await initiateWithdrawal(request);
      toast({
        title: "Success",
        description: `Withdrawal initiated. Amount: ${response.amount}, Rewards: ${response.rewards}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw Funds</CardTitle>
        <CardDescription>
          Enter your loan ID to withdraw funds and rewards
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loanId">Loan ID</Label>
            <Input
              id="loanId"
              placeholder="Enter loan ID"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Processing..." : "Withdraw"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 