
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ListChecks } from "lucide-react";

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
  id: string; // Using string as per openapi.yaml
  type: "DEPOSIT" | "SWAP" | "BRIDGE" | "STAKE" | "WITHDRAW"; // Using enum as per openapi.yaml
  status: "PENDING" | "COMPLETED" | "FAILED"; // Using enum as per openapi.yaml
  amount: string; // Using string as per openapi.yaml
  timestamp: string; // Using string as per openapi.yaml
  transactionHash?: string; // Using string as per openapi.yaml, optional
  // Add other relevant fields from the transaction history data
  details?: any; // Placeholder for additional details specific to the transaction type
}

interface ActivityLogProps {
  activities: Activity[];
}

export function ActivityLog({ activities }: ActivityLogProps) {
  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListChecks className="mr-2 h-6 w-6" />
          Recent Activity
        </CardTitle>
        <CardDescription>An overview of recent platform activities and transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px]">
          {/* Replace mockActivities with the actual activities prop */}
          <div className="space-y-6">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0">
                  {/* Adjust color based on status */}
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${activity.status === "COMPLETED" ? "bg-green-500" : activity.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"}`}></div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium leading-none">
                      {/* Display activity type and potentially other key info */}
                      {activity.type}
                    </p>
                    {/* Format timestamp as needed */}
                    <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {/* Display relevant transaction details */}
                    Amount: {activity.amount} | Transaction Hash: {activity.transactionHash || 'N/A'}
                    {/* Add other details based on activity type */}
                  </p>
                </div>
                {/* Adjust badge variant based on status */}
                <Badge variant={activity.status === "COMPLETED" ? "default" : activity.status === "FAILED" ? "destructive" : "secondary"} className={activity.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" : activity.status === "FAILED" ? "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" : ""}>
                  {activity.status}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
