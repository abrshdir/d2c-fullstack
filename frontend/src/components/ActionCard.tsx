
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, type LucideIcon, ArrowRight } from "lucide-react";

interface ActionCardProps {
  title: string;
  description: string | React.ReactNode;
  actionText: string;
  onAction: () => void | Promise<void>;
  isLoading?: boolean;
  isCompleted?: boolean;
  Icon?: LucideIcon;
  children?: React.ReactNode;
}

export function ActionCard({ title, description, actionText, onAction, isLoading, isCompleted, Icon, children }: ActionCardProps) {
  const ActionIcon = Icon || ArrowRight;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-3 mb-2">
          {Icon && <ActionIcon className="h-6 w-6 text-primary" />}
          <CardTitle className="text-2xl">{title}</CardTitle>
        </div>
        {typeof description === 'string' ? <CardDescription>{description}</CardDescription> : description}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
      {!isCompleted && (
        <CardFooter>
          <Button onClick={onAction} disabled={isLoading || isCompleted} className="w-full" size="lg">
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
               !Icon && <ArrowRight className="mr-2 h-5 w-5" />
            )}
            {isLoading ? "Processing..." : actionText}
          </Button>
        </CardFooter>
      )}
      {isCompleted && (
         <CardFooter>
            <p className="text-green-600 font-medium w-full text-center py-2">Step Completed!</p>
         </CardFooter>
      )}
    </Card>
  );
}
