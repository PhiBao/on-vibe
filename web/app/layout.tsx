import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import TerminalLayout from "@/components/TerminalLayout";

export const metadata: Metadata = {
  title: "PHOENIX TERMINAL — Swarm Trading v3",
  description: "Cyberpunk terminal for Phoenix perpetuals — multi-strategy swarm trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <Providers>
          <TerminalLayout>{children}</TerminalLayout>
        </Providers>
      </body>
    </html>
  );
}
