import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import { CreditManager } from '../core/creditManager';
import { Keypair } from '@solana/web3.js';

// Setup global fetch mock
global.fetch = jest.fn(async (url) => {
  if (url.includes('payment-check')) {
    return { json: async () => ({ cost: 10 }) };
  }
  if (url.includes('jup.ag/price')) {
    return {
      json: async () => ({
        data: {
          iTHSaXjdqFtcnLK4EFEs7mqYQbJb6B7GostqWbBQwaV: {
            price: 0.5
          }
        }
      })
    };
  }
  if (url.includes('quote-api.jup.ag/v6/quote')) {
    return { json: async () => ({ mockQuoteData: true }) };
  }
  if (url.includes('swap-instructions')) {
    return {
      json: async () => ({
        computeBudgetInstructions: [],
        setupInstructions: [],
        swapInstruction: {
          programId: 'EqtEVqxQUy4J9g8QgxJ8Pk8qPGyCCew6ZzkpzWGzbn3x',
          accounts: [],
          data: ''
        },
        cleanupInstruction: null,
        addressLookupTableAddresses: []
      })
    };
  }
  return { json: async () => ({}) };
}) as jest.Mock;

jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddressSync: jest
    .fn()
    .mockReturnValue(
      new PublicKey('DuZxdBUjdqyXpF5PYxMNvVg4vF6YpvNQqUhJ3t2bDcFB')
    ),
  getOrCreateAssociatedTokenAccount: jest.fn().mockResolvedValue({
    address: new PublicKey('8vUbQvMHkJqrPHqborKvFbp86DzFFV6RUjYkNbzHXxgK')
  }),
  createTransferInstruction: jest.fn().mockReturnValue(
    new TransactionInstruction({
      keys: [],
      programId: new PublicKey('4AgP3m6QKRHVDdkKZqGJE4VUz6uEfM1jNi3Jt1jKyZYx'),
      data: Buffer.from([])
    })
  ),
  TOKEN_PROGRAM_ID: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
}));

describe('CreditManager', () => {
  let creditManager: CreditManager;
  let mockConnection: jest.Mocked<Connection>;
  let mockWallet: jest.Mocked<Wallet>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock setTimeout with proper typing
    const originalSetTimeout = global.setTimeout;
    (global.setTimeout as any) = Object.assign(
      jest.fn((fn) => {
        fn();
        return originalSetTimeout(fn, 0);
      }),
      { __promisify__: originalSetTimeout.__promisify__ }
    );

    mockConnection = {
      getTokenAccountBalance: jest.fn(),
      getMultipleAccountsInfo: jest.fn().mockResolvedValue([]),
      sendRawTransaction: jest.fn(),
      confirmTransaction: jest.fn(),
      getSignatureStatus: jest.fn(),
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: 'EfhxGpbvDD1d2G8idszZqqdoLeAXvjrm5UzH1bsaHNBe',
        lastValidBlockHeight: 123456789
      })
    } as unknown as jest.Mocked<Connection>;

    const payer = Keypair.generate();
    mockWallet = {
      publicKey: payer.publicKey,
      payer: payer,
      signTransaction: jest.fn().mockImplementation(async (tx) => {
        tx.partialSign(payer);
        return tx;
      })
    } as unknown as jest.Mocked<Wallet>;

    creditManager = new CreditManager(
      mockConnection,
      mockWallet,
      'mockapi',
      5000
    );
  });

  describe('fetchBalance', () => {
    it('should fetch token balance correctly', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '1000000000',
          decimals: 9,
          uiAmount: 1,
          uiAmountString: '1'
        }
      });

      const balance = await creditManager.fetchBalance();
      expect(balance).toBe(1000000000);
      expect(mockConnection.getTokenAccountBalance).toHaveBeenCalled();
    });

    it('should return 0 when balance is 0', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '0',
          decimals: 9,
          uiAmount: 0,
          uiAmountString: '0'
        }
      });

      const balance = await creditManager.fetchBalance();
      expect(balance).toBe(0);
    });

    it('should return 0 when balance is empty string', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '',
          decimals: 9,
          uiAmount: 0,
          uiAmountString: ''
        }
      });

      const balance = await creditManager.fetchBalance();
      expect(balance).toBe(0);
    });

    it('should return 0 when token account does not exist', async () => {
      mockConnection.getTokenAccountBalance.mockRejectedValue(
        new Error('Account does not exist')
      );

      const balance = await creditManager.fetchBalance();
      expect(balance).toBe(0);
    });
  });

  describe('handleCredits', () => {
    it('should not require token purchase when balance is sufficient', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '20000000000',
          decimals: 9,
          uiAmount: 20,
          uiAmountString: '20'
        }
      });

      const result = await creditManager.handleCredits(1);

      expect(result.needsTokenPurchase).toBe(false);
      expect(result.requiredAmount).toBe(10.1); // 10 + 1% fee
      expect(result.amountToPurchase).toBe(0);
    });

    it('should require token purchase when balance is insufficient', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '5000000000',
          decimals: 9,
          uiAmount: 5,
          uiAmountString: '5'
        }
      });

      const result = await creditManager.handleCredits(1);

      expect(result.needsTokenPurchase).toBe(true);
      expect(result.requiredAmount).toBe(10.1); // 10 + 1% fee
      expect(result.amountToPurchase).toBe(5.1); // 10.1 - 5
    });
  });

  describe('handlePayment', () => {
    it('should complete purchase when enough balance exists', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '20000000000',
          decimals: 9,
          uiAmount: 20,
          uiAmountString: '20'
        }
      });

      mockConnection.sendRawTransaction.mockResolvedValue('mockSignature');
      mockConnection.getSignatureStatus.mockResolvedValue({
        context: { slot: 1 },
        value: {
          confirmationStatus: 'finalized',
          slot: 0,
          confirmations: null,
          err: null
        }
      });

      const result = await creditManager.handlePayment(1);

      expect(result).toBe('mockSignature');
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('quote-api.jup.ag')
      );
    });

    it('should swap tokens first when balance is insufficient', async () => {
      mockConnection.getTokenAccountBalance
        .mockResolvedValueOnce({
          context: { slot: 1 },
          value: {
            amount: '5000000000',
            decimals: 9,
            uiAmount: 5,
            uiAmountString: '5'
          }
        })
        .mockResolvedValueOnce({
          context: { slot: 2 },
          value: {
            amount: '20000000000',
            decimals: 9,
            uiAmount: 20,
            uiAmountString: '20'
          }
        });

      mockConnection.sendRawTransaction.mockResolvedValue('mockSignature');
      mockConnection.getSignatureStatus.mockResolvedValue({
        context: { slot: 2 },
        value: {
          confirmationStatus: 'finalized',
          slot: 0,
          confirmations: null,
          err: null
        }
      });

      const result = await creditManager.handlePayment(1);

      expect(result).toBe('mockSignature');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('quote-api.jup.ag')
      );
    });

    it('should throw error when transaction fails immediately', async () => {
      mockConnection.getTokenAccountBalance.mockResolvedValue({
        context: { slot: 1 },
        value: {
          amount: '20000000000',
          decimals: 9,
          uiAmount: 20,
          uiAmountString: '20'
        }
      });

      const error = new Error('Transaction failed');
      mockConnection.sendRawTransaction.mockRejectedValue(error);

      await expect(creditManager.handlePayment(1)).rejects.toThrow(
        'Transaction failed'
      );
    });
  });
});
