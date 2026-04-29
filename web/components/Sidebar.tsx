"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";

const links = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/trade", label: "Trade", icon: "⚡" },
  { href: "/positions", label: "Positions", icon: "📌" },
  { href: "/journal", label: "Journal", icon: "📒" },
  { href: "/backtest", label: "Backtest", icon: "🧪" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 glass border-r border-white/[0.06] flex flex-col z-50">
      {/* Logo */}
      <div className="p-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center border border-orange-500/20">
            <span className="text-sm">🔥</span>
          </div>
          <div>
            <div className="text-sm font-semibold">Phoenix Bot</div>
            <div className="text-[10px] text-[var(--text-tertiary)]">Swarm AI v2</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Connect */}
      <div className="p-3 border-t border-white/[0.06]">
        <ConnectButton />
      </div>
    </aside>
  );
}
