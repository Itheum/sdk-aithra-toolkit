import { Wallet } from '@project-serum/anchor';
import {
  Connection,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
  ComputeBudgetProgram,
  AddressLookupTableAccount,
  TransactionInstruction,
  PublicKey
} from '@solana/web3.js';
import itheumAgentLogger from './core/logger';
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';

interface SignAndSendTransactionParams {
  connection: Connection;
  wallet: Wallet;
  instructions: TransactionInstruction[];
  priorityFee?: number;
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}

export async function signSendAndConfirmTransaction({
  connection,
  wallet,
  instructions,
  priorityFee = 0,
  addressLookupTableAccounts = []
}: SignAndSendTransactionParams): Promise<TransactionSignature> {
  let { blockhash } = await connection.getLatestBlockhash();

  if (priorityFee > 0) {
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee
    });
    instructions = [priorityFeeIx, ...instructions];
  }

  // Create transaction with initial blockhash
  let versionedTx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message(addressLookupTableAccounts)
  );

  try {
    versionedTx.sign([wallet.payer]);
    const serializedTx = versionedTx.serialize();

    const signature: TransactionSignature = await connection.sendRawTransaction(
      serializedTx,
      {}
    );

    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    itheumAgentLogger.error(` Transaction failed`, error);
    throw Error('Transaction failed');
  }
}

export async function getTokenBalanceWeb3(
  connection: Connection,
  tokenMint: PublicKey,
  walletPublicKey: PublicKey
): Promise<number> {
  const ata = getAssociatedTokenAddressSync(
    tokenMint,
    walletPublicKey,
    true,
    TOKEN_PROGRAM_ID
  );

  try {
    const info = await connection.getTokenAccountBalance(ata);
    if (info.value.amount == null) {
      throw new Error('No balance found');
    }

    return Number(info.value.amount);
  } catch (error) {
    return 0;
  }
}
