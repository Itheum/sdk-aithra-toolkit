import { Wallet } from '@project-serum/anchor';
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionInstruction
} from '@solana/web3.js';
import { ICreditManager } from './types';
import itheumAgentLogger from './logger';
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
  private readonly ITHEUM_MINT = new PublicKey(
    'iTHSaXjdqFtcnLK4EFEs7mqYQbJb6B7GostqWbBQwaV'
  );
  private readonly BURNER_WALLET = new PublicKey(
    'ETRT3kRcn5k4yigqj7Q2j9Zvi7vkKhwD4tzw8H3GPJuc'
  );
  private readonly apiUrl: string;

  constructor(connection: Connection, wallet: Wallet, apiUrl: string) {
    this.connection = connection;
    this.wallet = wallet;
    this.balance = 0;
    this.apiUrl = apiUrl;
  }

  async fetchBalance(): Promise<number> {
    const balance = await getTokenBalanceWeb3(
      this.connection,
      this.ITHEUM_MINT,
      this.wallet.publicKey
    );
    return balance;
  }

  private async syncBalance(): Promise<void> {
    this.balance = await this.fetchBalance();
  }

  private async getCostPerFile(): Promise<number> {
    const response = await fetch(`http://${this.apiUrl}/payment-check`);
    const { costPerFile } = await response.json();
    return Number(costPerFile);
  }

  private async getItheumPrice(): Promise<number> {
    const tokenData = await (
      await fetch(
        `https://api.jup.ag/price/v2?ids=${this.ITHEUM_MINT.toString()}&vsToken=So11111111111111111111111111111111111111112`
      )
    ).json();
    return tokenData.data[this.ITHEUM_MINT.toString()].price;
  }

  async handleCredits(numberOfFiles: number): Promise<CreditRequirement> {
    await this.syncBalance();
    const costPerFile = await this.getCostPerFile();
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

  private async swapSolForItheum(amountInSol: number): Promise<string> {
    const lamports = Math.floor(amountInSol * Math.pow(10, 9));

    const quoteResponse = await (
      await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${this.ITHEUM_MINT.toString()}&amount=${lamports}&slippageBps=50`
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
      priorityFee: 50000
    });
  }

  private async sendTokensToBurner(amount: number): Promise<string> {
    const fromTokenAccount = getAssociatedTokenAddressSync(
      this.ITHEUM_MINT,
      this.wallet.publicKey
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.wallet.payer,
      this.ITHEUM_MINT,
      this.BURNER_WALLET
    );

    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount.address,
      this.wallet.publicKey,
      amount * Math.pow(10, 9)
    );

    return signSendAndConfirmTransaction({
      connection: this.connection,
      wallet: this.wallet,
      instructions: [transferInstruction],
      priorityFee: 50000
    });
  }

  async handlePayment(numberOfFiles: number): Promise<string> {
    try {
      const creditReq = await this.handleCredits(numberOfFiles);

      if (creditReq.needsTokenPurchase) {
        const itheumPrice = await this.getItheumPrice();
        const solAmount = creditReq.amountToPurchase * itheumPrice;

        const swapSignature = await this.swapSolForItheum(solAmount);
        itheumAgentLogger.success(
          `Swapped SOL for ITHEUM tokens. https://solscan.io/tx/${swapSignature}`
        );

        await this.syncBalance();
      }

      const paymentSignature = await this.sendTokensToBurner(
        creditReq.requiredAmount
      );
      itheumAgentLogger.success(
        `Credits sent to burner wallet. https://solscan.io/tx/${paymentSignature}`
      );

      return paymentSignature;
    } catch (err) {
      itheumAgentLogger.error(`Error buying credits: ${err}`);
      throw err;
    }
  }
}
