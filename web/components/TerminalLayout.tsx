"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const NAV = [
  { href: "/", label: "dashboard", icon: "◈" },
  { href: "/trade", label: "trade", icon: "⚡" },
  { href: "/positions", label: "positions", icon: "◉" },
  { href: "/bots", label: "bots", icon: "▣" },
  { href: "/backtest", label: "backtest", icon: "◊" },
];

function WalletConnect() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <button
        onClick={() => disconnect()}
        className="btn-terminal text-[11px] py-1.5 px-3"
        title="Disconnect wallet"
      >
        <span className="status-dot online mr-2" />
        {addr.slice(0, 6)}...{addr.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="btn-terminal btn-terminal-green text-[11px] py-1.5 px-3"
    >
      {connecting ? "connecting..." : "[ connect wallet ]"}
    </button>
  );
}

function SystemStatus() {
  const [time, setTime] = useState("");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toISOString().replace("T", " ").slice(0, 19));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 text-[10px] text-[var(--text-tertiary)]">
      <div className="flex items-center gap-1.5">
        <span className={`status-dot ${online ? "online" : "offline"}`} />
        <span className={online ? "text-[var(--green)]" : "text-[var(--red)]"}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      <span className="text-[var(--text-dim)]">|</span>
      <span>{time}</span>
      <span className="text-[var(--text-dim)]">UTC</span>
    </div>
  );
}

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] grid-bg terminal-flicker">
      {/* CRT overlay */}
      <div className="crt-overlay" />
      <div className="scanline" />

      <div className={`flex min-h-screen transition-opacity duration-500 ${booted ? "opacity-100" : "opacity-0"}`}>
        {/* Sidebar */}
        <aside className="w-56 flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm">
          {/* Logo */}
          <div className="p-4 border-b border-[var(--border)]">
            <Link href="/" className="block">
              <div className="text-[var(--cyan)] text-lg font-bold tracking-wider glow-cyan">
                PHOENIX
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] tracking-[0.2em] mt-0.5">
                SWARM_TERMINAL v3.0
              </div>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5">
            {NAV.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2 text-[12px] transition-all group ${
                    active
                      ? "bg-[var(--cyan)]/10 text-[var(--cyan)] border-l-2 border-[var(--cyan)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/[0.02] border-l-2 border-transparent"
                  }`}
                >
                  <span className={`text-sm ${active ? "text-[var(--cyan)]" : "text-[var(--text-dim)] group-hover:text-[var(--text-secondary)]"}`}>
                    {link.icon}
                  </span>
                  <span className="font-mono tracking-wide">
                    {active ? `> ${link.label}` : `  ${link.label}`}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Wallet */}
          <div className="p-3 border-t border-[var(--border)] space-y-2">
            <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">wallet</div>
            <WalletConnect />
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--border)]">
            <SystemStatus />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-h-screen overflow-auto">
          {/* Top bar */}
          <header className="h-12 border-b border-[var(--border)] flex items-center justify-between px-6 bg-[var(--bg-secondary)]/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
              <span className="text-[var(--cyan)]">root@phoenix:~$</span>
              <span className="animate-blink">_</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[var(--text-dim)]">NET:</span>
                <span className="text-[var(--green)]">MAINNET</span>
              </div>
              <div className="h-4 w-px bg-[var(--border)]" />
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-[var(--text-dim)]">RPC:</span>
                <span className="text-[var(--cyan)]">phoenix.trade</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
