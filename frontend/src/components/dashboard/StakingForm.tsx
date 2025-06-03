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

interface Validator {
  address: string;
  name: string;
  apy: number;
  commission: number;
  totalStaked: string;
  votingPower: number;
}

export function StakingForm() {
  const [amount, setAmount] = useState("");
  const [selectedValidator, setSelectedValidator] = useState<string>("");
  const [validators, setValidators] = useState<Validator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Mock validators data - replace with actual API call
  useEffect(() => {
    setValidators([
      {
        address: "0x123...abc",
        name: "Sui Validator 1",
        apy: 5.2,
        commission: 2,
        totalStaked: "1,000,000 SUI",
        votingPower: 0.8,
      },
      {
        address: "0x456...def",
        name: "Sui Validator 2",
        apy: 4.8,
        commission: 1.5,
        totalStaked: "800,000 SUI",
        votingPower: 0.6,
      },
    ]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedValidator || !amount) {
      toast({
        title: "Error",
        description: "Please select a validator and enter an amount",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement actual staking API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      toast({
        title: "Success",
        description: "Staking operation initiated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate staking",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake SUI</CardTitle>
        <CardDescription>
          Select a validator and amount to stake your SUI tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            {isLoading ? "Processing..." : "Stake SUI"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 