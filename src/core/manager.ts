import { Connection, Keypair } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import { itheumAgentLogger as logger } from './logger';
import {
  MintConfig,
  MusicNFTConfig,
  NFTType,
  ManifestType,
  NFTTypes,
  MusicPlaylistManifest
} from './types';
import { CreditManager } from './creditManager';
import { StorageManager } from './storageManager';
import { MarshalManager } from './marshalManager';
import { MintManager } from './mintManager';
import { NFTMetadataBuilderFactory } from './nftMetadataFactory';
import { buildPlaylistConfig } from '../helpers/buildPlaylist';
import fs from 'fs';
import path from 'path';
import { ManifestBuilderFactory } from './manifestFactory';

interface BuildUploadMintMusicNFTsParams {
  folderPath: string;
  playlist: {
    name: string;
    creator: string;
  };
  nft: {
    tokenName: string;
    sellerFeeBasisPoints: number;
    quantity: number;
    name: string;
    description: string;
  };
  animation: {
    animationUrl?: string;
    animationFile?: string;
  };
}

interface ConstructorParams {
  connection: Connection;
  keypair: Keypair;
  apiUrl: string;
  marshalUrl: string;
  mintUrl: string;
  priorityFee?: number;
}

export class ItheumManager {
  private wallet: Wallet;
  private filesCreditManager: CreditManager;
  private mintsCreditManager: CreditManager;
  private storageManager: StorageManager;
  private marshalManager: MarshalManager;
  private mintManager: MintManager;

  constructor({
    connection,
    keypair,
    apiUrl,
    marshalUrl,
    mintUrl,
    priorityFee = 0
  }: ConstructorParams) {
    this.wallet = new Wallet(keypair);
    this.filesCreditManager = new CreditManager(
      connection,
      this.wallet,
      apiUrl,
      priorityFee
    );
    this.mintsCreditManager = new CreditManager(
      connection,
      this.wallet,
      mintUrl,
      priorityFee
    );
    this.storageManager = new StorageManager(apiUrl);
    this.marshalManager = new MarshalManager(marshalUrl);
    this.mintManager = new MintManager(mintUrl);
  }

  async buildUploadMintMusicNFTs({
    folderPath,
    playlist,
    nft,
    animation
  }: BuildUploadMintMusicNFTsParams): Promise<{
    success: boolean;
    signatures: string[];
  }> {
    try {
      // Build playlist config and get files
      const { config, audioFiles, imageFiles } = await buildPlaylistConfig(
        folderPath,
        playlist.name,
        playlist.creator
      );

      logger.info('Playlist build from folder complete');

      let paymentHash = await this.filesCreditManager.handlePayment(
        audioFiles.length + imageFiles.length
      );

      const uploadedFiles = await this.storageManager.upload({
        files: [...audioFiles, ...imageFiles],
        category: ManifestType.MusicPlaylist,
        paymentHash: paymentHash,
        address: this.wallet.publicKey.toString()
      });

      logger.info('Files uploaded successfully');

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

      paymentHash = await this.filesCreditManager.handlePayment(1);

      const manifestBlob = new Blob([JSON.stringify(manifest)], {
        type: 'application/json'
      });
      const manifestFile = new File([manifestBlob], 'playlist-manifest.json', {
        type: 'application/json'
      });

      const manifestUpload = await this.storageManager.upload({
        files: [manifestFile],
        category: ManifestType.MusicPlaylist,
        paymentHash: paymentHash,
        address: this.wallet.publicKey.toString()
      });

      logger.info('Manifest uploaded successfully');

      const ipnsResponse = await this.storageManager.pinToIpns(
        manifestUpload[0].hash,
        this.wallet.publicKey.toString()
      );

      logger.info('Manifest pinned to IPNS successfully');

      // Handle animation file
      let animationUrl = animation.animationUrl;
      if (animation.animationFile) {
        const fileContent = await fs.promises.readFile(animation.animationFile);
        const fileName = path.basename(animation.animationFile);
        const fileType = path.extname(fileName).toLowerCase().slice(1);

        const mimeType = ['mp4', 'webm', 'ogg'].includes(fileType)
          ? `video/${fileType}`
          : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType)
            ? `image/${fileType === 'jpg' ? 'jpeg' : fileType}`
            : null;

        if (!mimeType) throw new Error('Unsupported animation file type');

        const animationFile = new File([fileContent], fileName, {
          type: mimeType
        });

        let paymentHash = await this.filesCreditManager.handlePayment(1);

        const uploadedAnimation = await this.storageManager.upload({
          files: [animationFile],
          category: 'staticdata',
          paymentHash: paymentHash,
          address: this.wallet.publicKey.toString()
        });

        logger.info('Animation file uploaded successfully');

        animationUrl = `https://gateway.lighthouse.storage/ipfs/${uploadedAnimation[0].hash}`;
      }

      if (!animationUrl) {
        throw new Error(
          'Either animationPath or animationUrl must be provided'
        );
      }

      // Generate NFT metadata
      const nftConfig: MusicNFTConfig = {
        animationUrl,
        itheumCreator: this.wallet.publicKey.toString(),
        itheumDataStreamUrl: `https://gateway.lighthouse.storage/ipfs/${ipnsResponse.pointingHash}?dmf-nestedstream=1`,
        imageUrl: animationUrl,
        name: nft.name,
        previewMusicUrl: `https://gateway.lighthouse.storage/ipfs/${uploadedFiles[0].hash}`,
        description: nft.description,
        tokenCode: 'MUSG',
        itheumDrop: '30'
      };

      const encryptedResponse = await this.marshalManager.encrypt({
        dataNFTStreamUrl: nftConfig.itheumDataStreamUrl,
        dataCreatorSOLAddress: this.wallet.publicKey.toString()
      });

      logger.info('Encrypted data stream URL successfully');

      nftConfig.itheumDataStreamUrl = encryptedResponse.encryptedMessage;
      const builder = NFTMetadataBuilderFactory.getBuilder(NFTTypes.Music);
      const nftMetadata = builder.buildMetadata(nftConfig);

      logger.info('NFT metadata built successfully');

      paymentHash = await this.filesCreditManager.handlePayment(1);

      const uploadedMetadata = await this.storageManager.upload({
        files: [new File([JSON.stringify(nftMetadata)], 'metadata.json')],
        category: 'staticdata',
        paymentHash: paymentHash,
        address: this.wallet.publicKey.toString()
      });

      logger.info('NFT metadata uploaded successfully');

      // Mint NFTs
      const mintConfig: MintConfig = {
        mintForSolAddr: this.wallet.publicKey.toString(),
        tokenName: nft.tokenName,
        metadataOnIpfsUrl: `https://gateway.lighthouse.storage/ipfs/${uploadedMetadata[0].hash}`,
        sellerFeeBasisPoints: nft.sellerFeeBasisPoints,
        creators: [{ address: this.wallet.publicKey.toString(), share: 100 }],
        quantity: nft.quantity
      };

      paymentHash = await this.mintsCreditManager.handlePayment(nft.quantity);

      const signatures = await this.mintManager.mint({
        config: mintConfig,
        paymentHash: paymentHash,
        address: this.wallet.publicKey.toString()
      });

      logger.info('NFTs minted successfully');
      logger.info(
        `NFTs minted: ${signatures.length} with signatures: ${signatures.join(', ')}`
      );

      return {
        success: true,
        signatures
      };
    } catch (error) {
      logger.error(`Error in buildUploadMintMusicNFTs: ${error}`);
      throw error;
    }
  }
}
