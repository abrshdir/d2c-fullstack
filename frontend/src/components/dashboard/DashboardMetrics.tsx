
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StakingStatus } from '../../lib/api/types'; // Import StakingStatus
// import { Users, DollarSign, BarChartBig, AlertTriangle } from "lucide-react"; // Example icons, replace as needed

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, description }) => (
  <Card className="w-full">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {/* <Icon className="h-4 w-4 text-muted-foreground" /> */}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);
interface DashboardMetricsProps {
  stakingStatus: StakingStatus | null;
}

export function DashboardMetrics({ stakingStatus }: DashboardMetricsProps) {
  // This component will display staking status data fetched using the /staking/status/{loanId} endpoint.
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
      {stakingStatus ? (
        <>
          <MetricCard title="Staking Status" value={stakingStatus.status} icon={null} /> {/* Replace null with an appropriate icon */}
          <MetricCard title="Staked Amount" value={stakingStatus.stakedAmount} icon={null} description={`Rewards Accrued: ${stakingStatus.rewardsAccrued}`} /> {/* Replace null with an appropriate icon */}
        </>
      ) : (<p>Loading staking status...</p>)} {/* Placeholder for loading state */}
    </div>
  );
}
