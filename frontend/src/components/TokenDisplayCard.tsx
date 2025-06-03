"use client";

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Token } from "@/lib/api/types";
import { Coins, CheckCircle2 } from 'lucide-react';

interface TokenDisplayCardProps {
  token: Token;
  onSelect: (token: Token) => void;
  isSelected: boolean;
}

export function TokenDisplayCard({ token, onSelect, isSelected }: TokenDisplayCardProps) {
  return (
    <Card className={`transition-all duration-200 ease-in-out hover:shadow-lg ${isSelected ? 'ring-2 ring-primary shadow-xl' : 'border-border'}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-muted rounded-full">
            <Coins className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">{token.name} ({token.symbol})</CardTitle>
            <CardDescription>Value: ${token.usdValue.toFixed(2)}</CardDescription>
          </div>
        </div>
        {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{token.balanceFormatted} {token.symbol}</div>
        <p className="text-xs text-muted-foreground">Available Balance</p>
        <Button 
          onClick={() => onSelect(token)} 
          className="w-full mt-4"
          variant={isSelected ? "default" : "outline"}
          disabled={isSelected}
        >
          {isSelected ? "Selected" : "Select Token"}
        </Button>
      </CardContent>
    </Card>
  );
}
