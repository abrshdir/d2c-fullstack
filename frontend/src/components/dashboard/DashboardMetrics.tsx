
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StakingStatus } from '../../lib/api/types'; // Import StakingStatus
import { AccountStatusResponse } from "../../lib/api/tokenScanner"; // Import AccountStatusResponse
// import { Users, DollarSign, BarChartBig, AlertTriangle, ShieldCheck, ShieldAlert, Lock } from "lucide-react"; // Example icons

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType; // Icon component
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, description }) => (
  <Card className="w-full">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

interface DashboardMetricsProps {
  accountStatus: AccountStatusResponse | null;
  stakingStatus: StakingStatus | null;
}

export function DashboardMetrics({ accountStatus, stakingStatus }: DashboardMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"> {/* Adjusted grid for more cards */}
      {accountStatus ? (
        <>
          <MetricCard
            title="Escrowed USDC"
            value={`${accountStatus.escrowedAmount} USDC`}
            // icon={Lock}
            description="USDC held in D2C Escrow"
          />
          <MetricCard
            title="Outstanding Debt"
            value={`${accountStatus.outstandingDebt} USDC`}
            // icon={DollarSign}
            description="Gas loan to be repaid"
          />
          <MetricCard
            title="Reputation Score"
            value={accountStatus.reputationScore}
            // icon={ShieldCheck}
            description={accountStatus.isBlacklisted ? "User is Blacklisted" : "User in Good Standing"}
          />
          {accountStatus.isBlacklisted && (
            <MetricCard
              title="Blacklist Status"
              value="Blacklisted"
              // icon={ShieldAlert}
              description="Repay debt and maintain good behavior"
            />
          )}
        </>
      ) : (
        <p className="col-span-full">Loading account status...</p>
      )}

      {stakingStatus ? (
        <>
          <MetricCard title="SUI Staking Status" value={stakingStatus.status || "N/A"} icon={null} />
          <MetricCard title="SUI Staked Amount" value={`${stakingStatus.stakedAmount || 0} SUI`} icon={null} description={`Rewards Accrued: ${stakingStatus.rewardsAccrued || 0} SUI`} />
        </>
      ) : (
        <p className="col-span-full md:col-span-2 lg:col-span-2">Loading SUI staking status...</p>
      )}
    </div>
  );
}
