import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Token Price Aggregator",
  description: "Compare token prices across DEX & CEX",
  icons: {
    icon: "/favicon2.svg",
  },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <img src="/favicon2.svg" alt="Logo" className="w-8 h-8" />
                <div className="flex items-center gap-2">
                  <span className="font-black text-xl tracking-tighter">AGGREGATOR</span>
                  <span className="tag-orange px-2 py-0.5 text-[9px]">BETA</span>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center gap-6 border-l-2 border-black pl-6 ml-2">
                <a 
                  href="https://brass-hands.vercel.app/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[12px] font-black uppercase tracking-widest text-black hover:text-[#ff4d00] transition-colors"
                >
                  Sweep
                </a>
                <a 
                  href="https://brass-hands.vercel.app/revoke" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[12px] font-black uppercase tracking-widest text-black hover:text-[#ff4d00] transition-colors"
                >
                  Revoke
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-black font-black tracking-widest">
                <span className="opacity-70">MULTI-CHAIN</span>
                <span className="w-1 h-1 bg-black rounded-full opacity-20"></span>
                <span className="opacity-70">REAL-TIME</span>
              </div>
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
            <p className="text-xs text-black/60 uppercase tracking-wider">
              Data from DexScreener · CoinGecko · GoPlus
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
