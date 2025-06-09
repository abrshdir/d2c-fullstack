"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StakingStatus } from "@/lib/api/types";
// import { Users, DollarSign, BarChartBig, AlertTriangle } from "lucide-react"; // Example icons, replace as needed

interface StakingInfo {
  totalStaked: string;
  rewards: string;
  validatorAddress: string;
  startDate: string;
  isActive: boolean;
}

interface DashboardMetricsProps {
  stakingStatus: StakingInfo | null;
}

export function DashboardMetrics({ stakingStatus }: DashboardMetricsProps) {
  if (!stakingStatus) {
    return null;
  }

  const calculateProgress = (rewards: string, staked: string) => {
    const rewardsNum = parseFloat(rewards.split(' ')[0]);
    const stakedNum = parseFloat(staked.split(' ')[0]);
    return (rewardsNum / stakedNum) * 100;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Staking Status</CardTitle>
          <CardDescription>Your current staking position</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Staked</span>
              <span className="font-medium">{stakingStatus.totalStaked}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Rewards</span>
              <span className="font-medium">{stakingStatus.rewards}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rewards Progress</span>
                <span>{calculateProgress(stakingStatus.rewards, stakingStatus.totalStaked).toFixed(2)}%</span>
              </div>
              <Progress value={calculateProgress(stakingStatus.rewards, stakingStatus.totalStaked)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validator Info</CardTitle>
          <CardDescription>Your staking validator details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Validator Address</span>
              <span className="font-medium">{stakingStatus.validatorAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Start Date</span>
              <span className="font-medium">{new Date(stakingStatus.startDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`font-medium ${stakingStatus.isActive ? 'text-green-500' : 'text-red-500'}`}>
                {stakingStatus.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
