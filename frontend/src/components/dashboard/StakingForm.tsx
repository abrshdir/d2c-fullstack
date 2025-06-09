"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useWallet } from '@suiet/wallet-kit';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface Validator {
  address: string;
  name: string;
  apy: number;
  commission: number;
  totalStaked: string;
  votingPower: number;
}

export function StakingForm() {
  const { connected, address: suiAddress, signAndExecuteTransaction } = useWallet();
  const [amount, setAmount] = useState("");
  const [selectedValidator, setSelectedValidator] = useState<string>("");
  const [validators, setValidators] = useState<Validator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch validators from SUI network
  useEffect(() => {
    const fetchValidators = async () => {
      try {
        // TODO: Replace with actual SUI validator API call
        const response = await fetch('/api/sui/validators');
        const data = await response.json();
        setValidators(data);
      } catch (error) {
        console.error('Failed to fetch validators:', error);
        setError('Failed to load validators. Please try again later.');
      }
    };

    if (connected) {
      fetchValidators();
    }
  }, [connected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) {
      toast({
        title: "Error",
        description: "Please connect your SUI wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!selectedValidator || !amount) {
      toast({
        title: "Error",
        description: "Please select a validator and enter an amount",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare staking transaction
      const txb = new TransactionBlock();
      const [coin] = txb.splitCoins(txb.gas, [txb.pure(parseInt(amount) * 1e9)]); // Convert to MIST
      txb.moveCall({
        target: '0x3::sui_system::request_add_stake',
        arguments: [
          txb.object('0x5'),
          coin,
          txb.pure(selectedValidator)
        ],
      });

      // Sign and execute transaction
      const result = await signAndExecuteTransaction({
        transaction: txb,
      });

      if (result.effects.status.status === 'success') {
        toast({
          title: "Success",
          description: "Staking operation completed successfully",
        });
        // Reset form
        setAmount("");
        setSelectedValidator("");
      } else {
        throw new Error(result.effects.status.error || 'Transaction failed');
      }
    } catch (error) {
      console.error('Staking error:', error);
      setError(error instanceof Error ? error.message : 'Failed to initiate staking');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate staking",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stake SUI</CardTitle>
          <CardDescription>
            Please connect your SUI wallet to start staking
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake SUI</CardTitle>
        <CardDescription>
          Select a validator and amount to stake your SUI tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="validator">Select Validator</Label>
            <Select
              value={selectedValidator}
              onValueChange={setSelectedValidator}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a validator" />
              </SelectTrigger>
              <SelectContent>
                {validators.map((validator) => (
                  <SelectItem key={validator.address} value={validator.address}>
                    <div className="flex flex-col">
                      <span className="font-medium">{validator.name}</span>
                      <span className="text-sm text-muted-foreground">
                        APY: {validator.apy}% | Commission: {validator.commission}%
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedValidator && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Validator Details</Label>
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Total Staked:</span>
                    <span className="font-medium">
                      {validators.find(v => v.address === selectedValidator)?.totalStaked}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Voting Power:</span>
                    <span className="font-medium">
                      {validators.find(v => v.address === selectedValidator)?.votingPower}%
                    </span>
                  </div>
                  <Progress 
                    value={validators.find(v => v.address === selectedValidator)?.votingPower} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Stake</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount in SUI"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Stake SUI"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 