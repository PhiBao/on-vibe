"use client";
import { useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, Connection, PublicKey } from "@solana/web3.js";
import { deserializeInstruction } from "@/lib/phoenix-tx";

export function usePhoenixTx() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const sendInstructions = useCallback(
    async (instructions: Array<{
      programId: string;
      keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
      data: string;
    }>): Promise<{ signature: string; error?: string }> => {
      if (!publicKey || !signTransaction || !connection) {
        return { signature: "", error: "Wallet not connected" };
      }

      try {
        const tx = new Transaction();
        for (const ix of instructions) {
          tx.add(deserializeInstruction(ix));
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        return { signature: sig };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { signature: "", error: message };
      }
    },
    [publicKey, signTransaction, connection]
  );

  return { sendInstructions, publicKey, connection };
}
