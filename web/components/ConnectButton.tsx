"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export default function ConnectButton() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <button
        onClick={() => disconnect()}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--green)]/10 text-[var(--green)] text-[12px] font-medium rounded-lg border border-[var(--green)]/20 hover:bg-[var(--green)]/20 transition-all"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)] pulse" />
        {addr.slice(0, 4)}...{addr.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="w-full px-4 py-2 bg-[var(--green)] text-black text-[13px] font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-all"
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
