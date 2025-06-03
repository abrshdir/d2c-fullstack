"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Wallet } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { useWallet } from "@suiet/wallet-kit";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { SuiConnectButton } from "@/components/SuiWalletProvider";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "On-Ramp" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Header() {
  const pathname = usePathname();
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const suiWallet = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-3 pl-2">
          <Image
            src="/asset/d2c.png"
            alt="Dust2Cash Logo"
            width={32}
            height={32}
            className="h-8 w-auto"
          />
          <span className="font-bold text-lg">Dust2Cash</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-4">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === item.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          {mounted && (isEvmConnected || suiWallet.connected) && (
            <div className="flex items-center space-x-2">
              {isEvmConnected && (
                <div className="flex items-center space-x-2 p-2 rounded-md border border-primary bg-secondary/30">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs font-medium text-foreground">EVM</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}
                    </p>
                  </div>
                </div>
              )}
              {suiWallet.connected && (
                <div className="flex items-center space-x-2 p-2 rounded-md border border-primary bg-secondary/30">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs font-medium text-foreground">SUI</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {suiWallet.account?.address?.slice(0, 6)}...
                      {suiWallet.account?.address?.slice(-4)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="grid gap-6 text-lg font-medium mt-8">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground",
                      pathname === item.href
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
