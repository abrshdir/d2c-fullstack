"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";
import { useWallet } from '@suiet/wallet-kit';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BridgeFormProps {
  onBridgeComplete?: (txHash: string) => void;
}

export function BridgeForm({ onBridgeComplete }: BridgeFormProps) {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { connected: isSuiConnected, address: suiAddress } = useWallet();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"evm-to-sui" | "sui-to-evm">("evm-to-sui");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (direction === "evm-to-sui" && !isEvmConnected) {
      toast({
        title: "Error",
        description: "Please connect your EVM wallet first",
        variant: "destructive",
      });
      return;
    }

    if (direction === "sui-to-evm" && !isSuiConnected) {
      toast({
        title: "Error",
        description: "Please connect your SUI wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (direction === "evm-to-sui") {
        // Implement EVM to SUI bridge
        const txHash = await bridgeEvmToSui(amount);
        toast({
          title: "Success",
          description: "Bridge transaction initiated successfully",
        });
        onBridgeComplete?.(txHash);
      } else {
        // Implement SUI to EVM bridge
        const txHash = await bridgeSuiToEvm(amount);
        toast({
          title: "Success",
          description: "Bridge transaction initiated successfully",
        });
        onBridgeComplete?.(txHash);
      }
    } catch (error) {
      console.error('Bridge error:', error);
      setError(error instanceof Error ? error.message : 'Failed to initiate bridge transaction');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate bridge transaction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mock bridge functions - replace with actual implementation
  const bridgeEvmToSui = async (amount: string): Promise<string> => {
    // TODO: Implement actual EVM to SUI bridge
    await new Promise(resolve => setTimeout(resolve, 2000));
    return "0x123...abc";
  };

  const bridgeSuiToEvm = async (amount: string): Promise<string> => {
    // TODO: Implement actual SUI to EVM bridge
    await new Promise(resolve => setTimeout(resolve, 2000));
    return "0x456...def";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bridge Assets</CardTitle>
        <CardDescription>
          Transfer assets between EVM and SUI chains
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
            <Label>Bridge Direction</Label>
            <Select
              value={direction}
              onValueChange={(value: "evm-to-sui" | "sui-to-evm") => setDirection(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bridge direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evm-to-sui">
                  <div className="flex items-center space-x-2">
                    <span>Ethereum</span>
                    <ArrowRight className="h-4 w-4" />
                    <span>SUI</span>
                  </div>
                </SelectItem>
                <SelectItem value="sui-to-evm">
                  <div className="flex items-center space-x-2">
                    <span>SUI</span>
                    <ArrowRight className="h-4 w-4" />
                    <span>Ethereum</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Bridge</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Wallet Status</Label>
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>EVM Wallet:</span>
                <span className="font-medium">
                  {isEvmConnected ? "Connected" : "Not Connected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SUI Wallet:</span>
                <span className="font-medium">
                  {isSuiConnected ? "Connected" : "Not Connected"}
                </span>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Bridge Assets"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 