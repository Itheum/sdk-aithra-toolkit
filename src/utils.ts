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
import {aithraToolkitLogger} from './core/logger';
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { Result } from './result';

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
  addressLookupTableAccounts 
}: SignAndSendTransactionParams): Promise<Result<TransactionSignature, Error>> {
  try {

  let { blockhash } = await connection.getLatestBlockhash();

  if (priorityFee > 0) {
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee
    });
    instructions = [priorityFeeIx, ...instructions];
  }

  
    let versionedTx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions
      }).compileToV0Message(addressLookupTableAccounts ?? [])
    );
    versionedTx.sign([wallet.payer]);
    const serializedTx = versionedTx.serialize();

    const signature: TransactionSignature = await connection.sendRawTransaction(
      serializedTx,
      {skipPreflight:true}
    );

    const MAX_RETRIES = 4;
    let currentTry = 0;

    // wait 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    while (currentTry < MAX_RETRIES) {
      try {
        const status = await connection.getSignatureStatus(signature);
        if (status.value.confirmationStatus === 'finalized' || 'confirmed') {
          return Result.ok(signature);
        } else {
          return Result.err(new Error('Transaction failed to confirm'));
        }
      } catch (confirmError) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        currentTry++;
        if (currentTry === MAX_RETRIES) {
          return Result.err(confirmError instanceof Error ? confirmError : new Error(String(confirmError)));
        }
      }
    }
    
    return Result.err(new Error('Transaction failed after maximum retries'));
  } catch (error) {
    aithraToolkitLogger.error(` Transaction failed`, error);
    return Result.err(new Error('Transaction failed'));
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
