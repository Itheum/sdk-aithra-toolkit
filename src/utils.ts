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
import aithraToolkitLogger from './core/logger';
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

    const MAX_RETRIES = 4;
    let currentTry = 0;

    // wait 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    while (currentTry < MAX_RETRIES) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status.value.confirmationStatus === 'finalized' || 'confirmed') {
          return signature;
        } else {
          throw new Error('Transaction failed to confirm');
        }
      } catch (confirmError) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        currentTry++;
        if (currentTry === MAX_RETRIES) {
          throw confirmError;
        }
      }
    }
  } catch (error) {
    aithraToolkitLogger.error(` Transaction failed`, error);
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
