import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Token Price Aggregator",
  description: "Compare token prices across DEX & CEX",
  icons: {
    icon: "/favicon2.svg"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon2.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <img src="/favicon2.svg" alt="Logo" className="w-8 h-8" />
                <span className="font-bold text-lg tracking-tight"></span>
              </div>
              <nav className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="tag tag-black">AGGREGATOR</span>
                  <span className="tag tag-gray">BETA</span>
                </div>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1">
                  <a href="https://brass-hands.vercel.app/" target="_blank" rel="noopener noreferrer" className="tag tag-black hover:bg-gray-800 transition-colors">SWEEP</a>
                  <a href="https://brass-hands.vercel.app/revoke" target="_blank" rel="noopener noreferrer" className="tag tag-black hover:bg-gray-800 transition-colors">REVOKE</a>
                </div>
              </nav>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>MULTI-CHAIN</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              <span>REAL-TIME</span>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 mt-16">
          <div className="max-w-6xl mx-auto px-4 py-6 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Data from DexScreener · CoinGecko · GoPlus
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
