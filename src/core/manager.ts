import { Connection, Keypair } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import { itheumAgentLogger as logger } from './logger';
import {
  ICreditManager,
  IStorageManager,
  MusicPlaylistConfig,
  MusicPlaylistManifest,
  UploadedFile,
  FileMetadata,
  ManifestType
} from './types';
import { CreditManager } from './creditManager';
import { StorageManager } from './storageManager';
import { ManifestBuilderFactory } from './manifest-builders';

export class ItheumManager {
  private wallet: Wallet;
  private creditManager: ICreditManager;
  private storageManager: IStorageManager;

  constructor(connection: Connection, keypair: Keypair, apiUrl: string) {
    this.wallet = new Wallet(keypair);
    this.creditManager = new CreditManager(connection, this.wallet, apiUrl);
    this.storageManager = new StorageManager(`http://${apiUrl}`);

    logger.info(
      `Itheum Manager initialized with wallet: ${this.wallet.publicKey.toString()}`
    );
  }

  /**
   * Uploads music files and creates a playlist manifest
   * @param files Array of music files to upload
   * @param config Playlist configuration including name, creator, and metadata
   * @returns Object containing upload status, manifest, and upload details
   */
  async uploadMusicFiles(files: File | File[], config: MusicPlaylistConfig) {
    try {
      const fileArray = Array.isArray(files) ? files : [files];
      logger.info(`Processing ${fileArray.length} music files for upload`);

      // 1. Handle payment
      const paymentSignature = await this.creditManager.handlePayment(
        fileArray.length
      );
      logger.info(`Payment processed with signature: ${paymentSignature}`);

      // 2. Upload files
      const uploadedFiles = await this.storageManager.upload({
        files: fileArray,
        category: ManifestType.MusicPlaylist,
        paymentHash: paymentSignature,
        address: this.wallet.publicKey.toString()
      });
      logger.info(`Files uploaded successfully`);

      // 3. Build manifest
      const manifestBuilder = ManifestBuilderFactory.getBuilder(
        ManifestType.MusicPlaylist
      );
      const manifest = (await manifestBuilder.buildManifest(
        ManifestType.MusicPlaylist,
        uploadedFiles,
        config
      )) as MusicPlaylistManifest;
      logger.info(`Manifest built successfully`);

      // 4. Create manifest JSON file
      const manifestBlob = new Blob([JSON.stringify(manifest)], {
        type: 'application/json'
      });
      const manifestFile = new File([manifestBlob], 'playlist-manifest.json', {
        type: 'application/json'
      });

      // 5. Upload manifest
      const manifestUpload = await this.storageManager.upload({
        files: manifestFile,
        category: ManifestType.MusicPlaylist,
        paymentHash: paymentSignature,
        address: this.wallet.publicKey.toString()
      });

      // 6. Manifest is the first object in response
      const manifestResponse = manifestUpload[0];

      // 7. Pin to IPNS
      const ipnsResponse = await this.storageManager.pinToIpns(
        manifestResponse.hash,
        this.wallet.publicKey.toString()
      );

      return {
        success: true,
        ipnsHash: ipnsResponse.hash,
        pointingHash: ipnsResponse.pointingHash
      };
    } catch (error) {
      logger.error(`Error in music upload process: ${error}`);
      throw error;
    }
  }
}
