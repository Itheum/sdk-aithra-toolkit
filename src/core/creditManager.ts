import { Wallet } from '@project-serum/anchor';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { ICreditManager } from './types';
import aithraToolkitLogger from './logger';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount
} from '@solana/spl-token';
import { getTokenBalanceWeb3, signSendAndConfirmTransaction } from '../utils';

interface CreditRequirement {
  requiredAmount: number;
  needsTokenPurchase: boolean;
  amountToPurchase: number;
}

export class CreditManager implements ICreditManager {
  private connection: Connection;
  private wallet: Wallet;
  private balance: number;
  private readonly AITHRA_MINT = new PublicKey(
    'iTHSaXjdqFtcnLK4EFEs7mqYQbJb6B7GostqWbBQwaV'
  );
  private readonly BURNER_WALLET = new PublicKey(
    '6EbThwoLgCi1EuYmg2WgdpwzhfJdApyNDftTitt6Gukf'
  );
  private readonly apiUrl: string;
  private readonly priorityFee: number;

  constructor(
    connection: Connection,
    wallet: Wallet,
    apiUrl: string,
    priorityFee: number
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.balance = 0;
    this.apiUrl = apiUrl;
    this.priorityFee = priorityFee;
  }

  async fetchBalance(): Promise<number> {
    const balance = await getTokenBalanceWeb3(
      this.connection,
      this.AITHRA_MINT,
      this.wallet.publicKey
    );
    return balance;
  }

  private async syncBalance(): Promise<void> {
    this.balance = await this.fetchBalance();
  }

  private async getCost(): Promise<number> {
    const response = await fetch(`${this.apiUrl}/payment-check`);
    const { cost } = await response.json();
    return Number(cost);
  }

  private async getAithraPrice(): Promise<number> {
    const tokenData = await (
      await fetch(
        `https://api.jup.ag/price/v2?ids=${this.AITHRA_MINT.toString()}&vsToken=So11111111111111111111111111111111111111112`
      )
    ).json();
    return tokenData.data[this.AITHRA_MINT.toString()].price;
  }

  async handleCredits(numberOfFiles: number): Promise<CreditRequirement> {
    await this.syncBalance();
    const costPerFile = await this.getCost();
    const totalCost = costPerFile * numberOfFiles;
    const totalCostWithSlippage = totalCost + totalCost * 0.01;

    const currentBalance = this.balance / Math.pow(10, 9);

    if (currentBalance >= totalCostWithSlippage) {
      return {
        requiredAmount: totalCostWithSlippage,
        needsTokenPurchase: false,
        amountToPurchase: 0
      };
    }

    return {
      requiredAmount: totalCostWithSlippage,
      needsTokenPurchase: true,
      amountToPurchase: totalCostWithSlippage - currentBalance
    };
  }

  private async swapSolForAithra(amountInSol: number): Promise<string> {
    const lamports = Math.floor(amountInSol * Math.pow(10, 9));

    const quoteResponse = await (
      await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${this.AITHRA_MINT.toString()}&amount=${lamports}&slippageBps=50`
      )
    ).json();

    const instructions = await (
      await fetch('https://quote-api.jup.ag/v6/swap-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: this.wallet.publicKey.toBase58()
        })
      })
    ).json();

    if (!instructions) {
      throw new Error('Failed to get swap instructions');
    }

    const {
      computeBudgetInstructions,
      setupInstructions,
      swapInstruction,
      cleanupInstruction,
      addressLookupTableAddresses
    } = instructions;

    const deserializeInstruction = (instruction) => {
      return new TransactionInstruction({
        programId: new PublicKey(instruction.programId),
        keys: instruction.accounts.map((key) => ({
          pubkey: new PublicKey(key.pubkey),
          isSigner: key.isSigner,
          isWritable: key.isWritable
        })),
        data: Buffer.from(instruction.data, 'base64')
      });
    };

    const preparedInstructions = [
      ...computeBudgetInstructions.map(deserializeInstruction),
      ...setupInstructions.map(deserializeInstruction),
      deserializeInstruction(swapInstruction),
      ...(cleanupInstruction
        ? [deserializeInstruction(cleanupInstruction)]
        : [])
    ];

    return signSendAndConfirmTransaction({
      connection: this.connection,
      wallet: this.wallet,
      instructions: preparedInstructions,
      addressLookupTableAccounts: addressLookupTableAddresses,
      priorityFee: this.priorityFee
    });
  }

  public async pay(amount: number): Promise<string> {
    const fromTokenAccount = getAssociatedTokenAddressSync(
      this.AITHRA_MINT,
      this.wallet.publicKey
    );

    const toTokenAccount = getAssociatedTokenAddressSync(
      this.AITHRA_MINT,
      this.BURNER_WALLET
    );

    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      this.wallet.publicKey,
      amount * Math.pow(10, 9)
    );

    return signSendAndConfirmTransaction({
      connection: this.connection,
      wallet: this.wallet,
      instructions: [transferInstruction],
      priorityFee: this.priorityFee
    });
  }

  async handlePayment(numberOfFiles: number): Promise<string> {
    try {
      const creditReq = await this.handleCredits(numberOfFiles);

      if (creditReq.needsTokenPurchase) {
        const aithraPrice = await this.getAithraPrice();
        const solAmount = creditReq.amountToPurchase * aithraPrice;

        const swapSignature = await this.swapSolForAithra(solAmount);
        aithraToolkitLogger.success(
          `Swapped SOL for AITHRA tokens. https://solscan.io/tx/${swapSignature}`
        );

        await this.syncBalance();
      }

      const paymentSignature = await this.pay(creditReq.requiredAmount);
      aithraToolkitLogger.log(
        `Payment sent. https://solscan.io/tx/${paymentSignature}`
      );

      return paymentSignature;
    } catch (err) {
      aithraToolkitLogger.error(`Error buying credits: ${err}`);
      throw err;
    }
  }
}
