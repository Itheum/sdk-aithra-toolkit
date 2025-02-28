import { Wallet } from '@project-serum/anchor';
import { Connection, PublicKey, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
import { ICreditManager } from './types';
import { aithraToolkitLogger } from './logger';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount
} from '@solana/spl-token';
import { getTokenBalanceWeb3, signSendAndConfirmTransaction } from '../utils';
import { Result } from '../result';

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

  async fetchBalance(): Promise<Result<number, Error>> {
    aithraToolkitLogger.debug('Entering fetchBalance');
    try {
      const balance = await getTokenBalanceWeb3(
        this.connection,
        this.AITHRA_MINT,
        this.wallet.publicKey
      );
      aithraToolkitLogger.debug('Exiting fetchBalance');
      return Result.ok(balance);
    } catch (err) {
      return Result.err(new Error(`Failed to fetch balance: ${err.message}`));
    }
  }

  private async syncBalance(): Promise<Result<void, Error>> {
    aithraToolkitLogger.debug('Entering syncBalance');
    const balanceResult = await this.fetchBalance();
    if (balanceResult.isErr()) {
      return Result.err(balanceResult.getErr()!);
    }
    this.balance = balanceResult.unwrap();
    aithraToolkitLogger.debug('Exiting syncBalance');
    return Result.ok();
  }

  async getCost(): Promise<Result<number, Error>> {
    aithraToolkitLogger.debug('Entering getCost');
    try {
      const response = await fetch(`${this.apiUrl}/payment-check`);
      const { cost } = await response.json();
      aithraToolkitLogger.debug('Exiting getCost');
      return Result.ok(Number(cost));
    } catch (err) {
      return Result.err(new Error(`Failed to get cost: ${err.message}`));
    }
  }

  public async getAithraPriceInUsd(): Promise<Result<number, Error>> {
    aithraToolkitLogger.debug('Entering getAithraPriceInUsd');
    try {
      const tokenData = await (
        await fetch(
          `https://api.jup.ag/price/v2?ids=${this.AITHRA_MINT.toString()}`
        )
      ).json();
      aithraToolkitLogger.debug('Exiting getAithraPriceInUsd');
      return Result.ok(Number(tokenData.data[this.AITHRA_MINT.toString()].price));
    } catch (err) {
      return Result.err(new Error(`Failed to get USD price: ${err.message}`));
    }
  }

  private async getAithraPriceInSol(): Promise<Result<number, Error>> {
    aithraToolkitLogger.debug('Entering getAithraPriceInSol');
    try {
      const tokenData = await (
        await fetch(
          `https://api.jup.ag/price/v2?ids=${this.AITHRA_MINT.toString()}&vsToken=So11111111111111111111111111111111111111112`
        )
      ).json();
      aithraToolkitLogger.debug('Exiting getAithraPriceInSol');
      return Result.ok(tokenData.data[this.AITHRA_MINT.toString()].price);
    } catch (err) {
      return Result.err(new Error(`Failed to get SOL price: ${err.message}`));
    }
  }

  async handleCredits(numberOfFiles: number): Promise<Result<CreditRequirement, Error>> {
    aithraToolkitLogger.debug('Entering handleCredits');
    const syncResult = await this.syncBalance();
    if (syncResult.isErr()) return Result.err(syncResult.getErr()!);

    const costResult = await this.getCost();
    if (costResult.isErr()) return Result.err(costResult.getErr()!);

    const costPerFile = costResult.unwrap();
    const totalCost = costPerFile * numberOfFiles;
    const totalCostWithSlippage = totalCost + totalCost * 0.005;

    const currentBalance = this.balance / Math.pow(10, 9);

    aithraToolkitLogger.debug('Exiting handleCredits');
    return Result.ok({
      requiredAmount: totalCostWithSlippage,
      needsTokenPurchase: currentBalance < totalCostWithSlippage,
      amountToPurchase: Math.max(0, totalCostWithSlippage - currentBalance)
    });
  }

  private async swapSolForAithra(amountInSol: number): Promise<Result<string, Error>> {
    aithraToolkitLogger.debug('Entering swapSolForAithra');
    try {
      let lamports = Math.floor(amountInSol * Math.pow(10, 9));

      // slippage + 1% 
      lamports = Math.floor(lamports * 1.1);

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

      const getAddressLookupTableAccounts = async (
        keys: string[]
      ): Promise<AddressLookupTableAccount[]> => {
        if (!keys || keys.length === 0) return [];

        const addressLookupTableAccountInfos =
          await this.connection.getMultipleAccountsInfo(
            keys.map((key) => new PublicKey(key))
          );

        return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
          const addressLookupTableAddress = keys[index];
          if (accountInfo) {
            const addressLookupTableAccount = new AddressLookupTableAccount({
              key: new PublicKey(addressLookupTableAddress),
              state: AddressLookupTableAccount.deserialize(accountInfo.data),
            });
            acc.push(addressLookupTableAccount);
          }
          return acc;
        }, new Array<AddressLookupTableAccount>());
      };

      // Get address lookup table accounts
      const addressLookupTableAccounts = await getAddressLookupTableAccounts(
        addressLookupTableAddresses || []
      );

      const transactionResponse = await signSendAndConfirmTransaction({
        connection: this.connection,
        wallet: this.wallet,
        instructions: preparedInstructions,
        addressLookupTableAccounts, // Use the properly formatted accounts
        priorityFee: this.priorityFee
      });

      if (transactionResponse.isErr()) {
        return Result.err(transactionResponse.getErr());
      }

      aithraToolkitLogger.debug('Exiting swapSolForAithra');
      return Result.ok(transactionResponse.unwrap());
    } catch (err) {
      return Result.err(new Error(`Swap failed: ${err.message}`));
    }
  }

  public async pay(amount: number): Promise<Result<string, Error>> {
    aithraToolkitLogger.debug('Entering pay');
    try {
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
        Math.floor(amount * Math.pow(10, 9))
      );

      const transactionResponse = await signSendAndConfirmTransaction({
        connection: this.connection,
        wallet: this.wallet,
        instructions: [transferInstruction],
        priorityFee: this.priorityFee
      });

      if (transactionResponse.isErr()) {
        return Result.err(transactionResponse.getErr());
      }

      aithraToolkitLogger.debug('Exiting pay');
      return Result.ok(transactionResponse.unwrap());
    } catch (err) {
      return Result.err(new Error(`Payment failed: ${err.message}`));
    }
  }

  async handlePayment(numberOfFiles: number): Promise<Result<string, Error>> {
    aithraToolkitLogger.debug('Entering handlePayment');
    const creditReqResult = await this.handleCredits(numberOfFiles);
    if (creditReqResult.isErr()) return Result.err(creditReqResult.getErr()!);

    const creditReq = creditReqResult.unwrap();

    if (creditReq.needsTokenPurchase) {
      const priceResult = await this.getAithraPriceInSol();
      if (priceResult.isErr()) return Result.err(priceResult.getErr()!);

      const aithraPrice = priceResult.unwrap();
      const solAmount = creditReq.amountToPurchase * aithraPrice;

      const swapResult = await this.swapSolForAithra(solAmount);
      if (swapResult.isErr()) return Result.err(swapResult.getErr()!);

      aithraToolkitLogger.success(
        `Swapped SOL for AITHRA tokens. https://solscan.io/tx/${swapResult.unwrap()}`
      );

      const syncResult = await this.syncBalance();
      if (syncResult.isErr()) return Result.err(syncResult.getErr()!);
    }

    const paymentResult = await this.pay(creditReq.requiredAmount);
    if (paymentResult.isErr()) return Result.err(paymentResult.getErr()!);

    const signature = paymentResult.unwrap();
    aithraToolkitLogger.log(
      `Payment sent. https://solscan.io/tx/${signature}`
    );
    aithraToolkitLogger.debug('Exiting handlePayment');
    return Result.ok(signature);
  }
}
