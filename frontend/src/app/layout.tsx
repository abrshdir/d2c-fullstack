import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { SuiWalletProvider } from "@/components/SuiWalletProvider";
import { WagmiProvider } from "@/components/providers/WagmiProvider";
import { HydrationFix } from "@/components/HydrationFix";

export const metadata: Metadata = {
  title: "Gasless On-Ramp",
  description: "Seamlessly onboard to Web3 with gasless transactions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          GeistSans.variable,
          GeistMono.variable
        )}
      >
        <HydrationFix />
        <WagmiProvider>
          <SuiWalletProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {children}
              </main>
              <Toaster />
            </div>
          </SuiWalletProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
