import { PublicKey, TransactionInstruction, Transaction, Connection, VersionedTransaction } from "@solana/web3.js";

// AccountRole values from @solana/kit
const READONLY = 0;
const WRITABLE = 1;
const READONLY_SIGNER = 2;
const WRITABLE_SIGNER = 3;

export interface SerializedInstruction {
  programId: string;
  keys: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string; // base64
}

export function serializeInstruction(ix: {
  programAddress: string;
  accounts: Array<{ address: string; role: number }>;
  data: Uint8Array;
}): SerializedInstruction {
  return {
    programId: ix.programAddress,
    keys: ix.accounts.map((acc) => {
      const role = typeof acc.role === "number" ? acc.role : 0;
      return {
        pubkey: acc.address,
        isSigner: role >= READONLY_SIGNER,
        isWritable: role === WRITABLE || role === WRITABLE_SIGNER,
      };
    }),
    data: Buffer.from(ix.data).toString("base64"),
  };
}

export function deserializeInstruction(serialized: SerializedInstruction): TransactionInstruction {
  return new TransactionInstruction({
    keys: serialized.keys.map((k) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    programId: new PublicKey(serialized.programId),
    data: Buffer.from(serialized.data, "base64"),
  });
}

export function buildTransaction(instructions: SerializedInstruction[]): Transaction {
  const tx = new Transaction();
  for (const ix of instructions) {
    tx.add(deserializeInstruction(ix));
  }
  return tx;
}

export async function sendTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: any[] // wallet adapter signTransaction
) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signers[0].publicKey;

  // If wallet adapter has signTransaction, use it
  if (typeof (signers[0] as any).signTransaction === "function") {
    const signed = await (signers[0] as any).signTransaction(transaction);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  }

  throw new Error("Wallet adapter must implement signTransaction");
}
