import { Connection, Keypair } from '@solana/web3.js';
import { ItheumManager } from '../core/manager';
import { ManifestType } from '../core/types';
import { CreditManager } from '../core/creditManager';
import { StorageManager as ItheumStorageManager } from '../core/storageManager';
import logger from '../core/logger';

// Mock dependencies at module level
jest.mock('../core/creditManager');
jest.mock('../core/storageManager');
jest.mock('../core/logger');

describe('ItheumManager', () => {
  let manager: ItheumManager;
  let connection: Connection;
  let keypair: Keypair;

  const apiUrl = 'test.api.itheum.io';
  const mockPaymentSignature = 'test-payment-signature';
  const mockIpnsHash = 'test-ipns-hash';
  const mockPointingHash = 'test-pointing-hash';

  beforeEach(() => {
    jest.clearAllMocks();

    connection = new Connection('http://localhost:8899');
    keypair = Keypair.generate();

    // Simple mock implementations
    (CreditManager as jest.Mock).mockImplementation(() => ({
      handlePayment: jest.fn().mockResolvedValue(mockPaymentSignature)
    }));

    (ItheumStorageManager as jest.Mock).mockImplementation(() => ({
      upload: jest.fn().mockResolvedValue([{ hash: 'test-hash' }]),
      pinToIpns: jest.fn().mockResolvedValue({
        hash: mockIpnsHash,
        pointingHash: mockPointingHash
      })
    }));

    manager = new ItheumManager(connection, keypair, apiUrl);
  });

  describe('uploadMusicFiles', () => {
    const mockFiles = [new File(['test'], 'test1.mp3', { type: 'audio/mp3' })];

    const mockConfig = {
      name: 'Test Playlist',
      creator: 'test-creator'
    };

    it('should coordinate the upload process successfully', async () => {
      const result = await manager.uploadMusicFiles(mockFiles, mockConfig);

      expect(result).toEqual({
        success: true,
        ipnsHash: mockIpnsHash,
        pointingHash: mockPointingHash
      });
    });

    it('should handle upload errors gracefully', async () => {
      (ItheumStorageManager as jest.Mock).mockImplementation(() => ({
        upload: jest.fn().mockRejectedValue(new Error('Upload failed'))
      }));

      manager = new ItheumManager(connection, keypair, apiUrl);

      await expect(
        manager.uploadMusicFiles(mockFiles, mockConfig)
      ).rejects.toThrow('Upload failed');

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
