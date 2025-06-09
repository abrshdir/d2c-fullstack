"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

// This component is a placeholder to display transaction history.
// It will display data fetched using the /transactions/history endpoint.
// It accepts props to receive transaction history data and display it.

// Mock activity data
const mockActivities = [
  { id: 1, user: "0x123...abc", action: "Permit Signed", token: "ALP", amount: "10.5", status: "Success", timestamp: "2023-10-26 10:05 AM" },
  { id: 2, user: "0x456...def", action: "Token Swap", from: "BET", to: "USDC", status: "Success", timestamp: "2023-10-26 10:02 AM" },
  { id: 3, user: "0x789...ghi", action: "Lock Collateral", amount: "$150.20", status: "Success", timestamp: "2023-10-26 09:55 AM" },
  { id: 4, user: "0xabc...123", action: "Withdraw Attempt", amount: "$50.00", status: "Failed", reason: "Insufficient funds", timestamp: "2023-10-26 09:40 AM" },
  { id: 5, user: "0xdef...456", action: "Stake on SUI", status: "Success", timestamp: "2023-10-25 03:12 PM" },
  { id: 6, user: "0xghi...789", action: "Finalize Rewards", status: "Success", timestamp: "2023-10-25 01:00 PM" },
  { id: 7, user: "0xjkl...mno", action: "Token Scan", tokensFound: 3, status: "Success", timestamp: "2023-10-25 12:50 PM" },
];

// Define the type for activity data based on the TransactionHistory schema in openapi.yaml
// This is a placeholder and should be replaced with the actual type from the API client
interface Activity {
  id: string;
  type: "DEPOSIT" | "SWAP" | "BRIDGE" | "STAKE" | "WITHDRAW" | "REWARD" | "GAS_LOAN";
  status: "PENDING" | "COMPLETED" | "FAILED";
  amount: string;
  timestamp: string;
  transactionHash?: string;
  fromChain?: string;
  toChain?: string;
  fromToken?: string;
  toToken?: string;
  validatorAddress?: string;
  error?: string;
}

interface ActivityLogProps {
  activities?: Activity[];
  isLoading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

export function ActivityLog({ activities = [], isLoading = false, error, onRefresh }: ActivityLogProps) {
  const { toast } = useToast();
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'DEPOSIT':
        return '💰';
      case 'SWAP':
        return '🔄';
      case 'BRIDGE':
        return '🌉';
      case 'STAKE':
        return '🔒';
      case 'WITHDRAW':
        return '💸';
      case 'REWARD':
        return '🎁';
      case 'GAS_LOAN':
        return '⛽';
      default:
        return '📝';
    }
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
      default:
        return '';
    }
  };

  const getExplorerLink = (hash: string, chain: string) => {
    switch (chain?.toLowerCase()) {
      case 'ethereum':
        return `https://etherscan.io/tx/${hash}`;
      case 'sui':
        return `https://suiexplorer.com/txblock/${hash}`;
      default:
        return null;
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: "Copied!",
      description: "Transaction hash copied to clipboard",
    });
  };

  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-6 w-6" />
            Recent Activity
          </CardTitle>
          <CardDescription>An overview of recent platform activities and transactions.</CardDescription>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No activities found
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
                >
                  <div className="flex-shrink-0 text-2xl">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-none">
                        {activity.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Amount: {activity.amount}
                      {activity.fromToken && activity.toToken && (
                        <span> | {activity.fromToken} → {activity.toToken}</span>
                      )}
                    </p>
                    {expandedActivity === activity.id && (
                      <div className="mt-2 space-y-2 text-sm">
                        {activity.fromChain && activity.toChain && (
                          <p>Bridge: {activity.fromChain} → {activity.toChain}</p>
                        )}
                        {activity.validatorAddress && (
                          <p>Validator: {activity.validatorAddress}</p>
                        )}
                        {activity.transactionHash && (
                          <div className="flex items-center space-x-2">
                            <p>Transaction:</p>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {activity.transactionHash.slice(0, 8)}...{activity.transactionHash.slice(-6)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyHash(activity.transactionHash!);
                              }}
                            >
                              Copy
                            </Button>
                            {getExplorerLink(activity.transactionHash, activity.fromChain || '') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = getExplorerLink(activity.transactionHash!, activity.fromChain || '');
                                  if (link) {
                                    window.open(link, '_blank');
                                  }
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                        {activity.error && (
                          <p className="text-red-500">Error: {activity.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant={activity.status === "COMPLETED" ? "default" : activity.status === "FAILED" ? "destructive" : "secondary"}
                    className={getStatusColor(activity.status)}
                  >
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
