import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Phoenix Bot — AI Trading Dashboard",
  description: "Multi-strategy AI trading bot for Phoenix perpetuals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-56 p-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
