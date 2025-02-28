import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import { aithraToolkitLogger, aithraToolkitLogger as logger } from './logger';
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
import { Result } from '../result';

interface BuildUploadMintMusicNFTsParams {
  folderPath: string;
  playlist: {
    name: string;
    creator: string;
  };
  tokenCode?: string;
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
  creator?: string;
  referenceTrackCreator?: string
}

interface ConstructorParams {
  connection: Connection;
  keypair: Keypair;
  priorityFee?: number;
}

export interface BuildMusicNFTResult {
  success: boolean;
  assetIds: string[];
  animationUrl: string;
  trackUrl: string;
  trackImageUrl: string;
}

export class AithraManager {
  private wallet: Wallet;
  private filesCreditManager: CreditManager;
  private mintsCreditManager: CreditManager;
  private storageManager: StorageManager;
  private marshalManager: MarshalManager;
  private mintManager: MintManager;
  private apiUrl = 'https://api.itheumcloud.com/zsuiteapi';
  private marshalUrl = 'https://api.itheumcloud.com/datamarshalapi/router/v1';
  private mintUrl = 'https://api.itheumcloud.com/itheumapi';

  constructor({ connection, keypair, priorityFee = 0 }: ConstructorParams) {
    this.wallet = new Wallet(keypair);
    this.filesCreditManager = new CreditManager(
      connection,
      this.wallet,
      this.apiUrl,
      priorityFee
    );
    this.mintsCreditManager = new CreditManager(
      connection,
      this.wallet,
      this.mintUrl,
      priorityFee
    );
    this.storageManager = new StorageManager(this.apiUrl);
    this.marshalManager = new MarshalManager(this.marshalUrl);
    this.mintManager = new MintManager(this.mintUrl);
  }

  async getTotalCost(numberOfSongs: number, numberOfMints: number): Promise<Result<number, Error>> {
    // const generateSongPrice = 0.035;

    // const priceResult = await this.mintsCreditManager.getAithraPriceInUsd();
    // if (priceResult.isErr()) {
    //   return Result.err(priceResult.getErr());
    // }
    // const aithraUsdPrice = priceResult.unwrap() || 0.001;

    // const generateSongPriceAithra = generateSongPrice / aithraUsdPrice;

    // const fileCostResult = await this.filesCreditManager.getCost();
    // if (fileCostResult.isErr()) {
    //   return Result.err(fileCostResult.getErr());
    // }

    // const mintCostResult = await this.mintsCreditManager.getCost();
    // if (mintCostResult.isErr()) {
    //   return Result.err(mintCostResult.getErr());
    // }

    // const totalCost = (numberOfSongs * fileCostResult.unwrap() + 2 * fileCostResult.unwrap()) + 
    //                  (numberOfMints * mintCostResult.unwrap()) + 
    //                  (numberOfSongs * generateSongPriceAithra);

    const GENERATE_MUSIC_MEME_PRICE_IN_USD = 0.3;
    try {
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
      const data = await response.json();
      const currentSolPrice = data.solana.usd;

      const solAmount = GENERATE_MUSIC_MEME_PRICE_IN_USD / currentSolPrice;

      return Result.ok(Number(solAmount.toFixed(4)))

    } catch (error) {
      console.error("Failed to fetch SOL price:", error);
      Result.err(new Error(error));
    }
  }


  async buildUploadMintMusicNFTs(params: BuildUploadMintMusicNFTsParams): Promise<Result<BuildMusicNFTResult, Error>> {
    aithraToolkitLogger.debug('Entering buildUploadMintMusicNFTs');
    const playlistResult = await buildPlaylistConfig(
      params.folderPath,
      params.playlist.name,
      params.playlist.creator
    );
    if (playlistResult.isErr()) {
      return Result.err(playlistResult.getErr());
    }
    const { config, audioFiles, imageFiles } = playlistResult.unwrap();
    logger.info('Playlist build from folder complete');

    // 2. Handle file uploads
    const paymentResult = await this.filesCreditManager.handlePayment(
      audioFiles.length + imageFiles.length
    );
    if (paymentResult.isErr()) {
      return Result.err(paymentResult.getErr());
    }

    const uploadResult = await this.storageManager.upload({
      files: [...audioFiles, ...imageFiles],
      category: ManifestType.MusicPlaylist,
      paymentHash: paymentResult.unwrap(),
      address: this.wallet.publicKey.toString()
    });
    if (uploadResult.isErr()) {
      return Result.err(uploadResult.getErr());
    }
    logger.info('Files uploaded successfully');

    // 3. Build and upload manifest
    aithraToolkitLogger.debug('Getting the Manifest Builder');
    const builderResult = ManifestBuilderFactory.getBuilder(ManifestType.MusicPlaylist);
    if (builderResult.isErr()) {
      return Result.err(builderResult.getErr());
    }

    aithraToolkitLogger.debug('Building the manifest file');
    const manifestResult = await builderResult.unwrap().buildManifest(
      ManifestType.MusicPlaylist,
      uploadResult.unwrap(),
      config
    );
    if (manifestResult.isErr()) {
      return Result.err(manifestResult.getErr());
    }
    logger.info('Manifest built successfully');

    const manifestPaymentResult = await this.filesCreditManager.handlePayment(1);
    if (manifestPaymentResult.isErr()) {
      return Result.err(manifestPaymentResult.getErr());
    }

    const manifestBlob = new Blob([JSON.stringify(manifestResult.unwrap())], {
      type: 'application/json'
    });
    const manifestFile = new File([manifestBlob], 'playlist-manifest.json', {
      type: 'application/json'
    });

    const manifestUploadResult = await this.storageManager.upload({
      files: [manifestFile],
      category: ManifestType.MusicPlaylist,
      paymentHash: manifestPaymentResult.unwrap(),
      address: this.wallet.publicKey.toString()
    });
    if (manifestUploadResult.isErr()) {
      return Result.err(manifestUploadResult.getErr());
    }
    logger.info('Manifest uploaded successfully');

    // 4. Pin to IPNS
    const ipnsResult = await this.storageManager.pinToIpns(
      manifestUploadResult.unwrap()[0].hash,
      this.wallet.publicKey.toString()
    );
    if (ipnsResult.isErr()) {
      return Result.err(ipnsResult.getErr());
    }
    logger.info('Manifest pinned to IPNS successfully');

    // 5. Handle animation file/URL
    const animationResult = await this.handleAnimation(params.animation);
    if (animationResult.isErr()) {
      return Result.err(animationResult.getErr());
    }
    const animationUrl = animationResult.unwrap();

    const trackUrl = `https://gateway.lighthouse.storage/ipfs/${uploadResult.unwrap()[0].hash}`;
    const trackImageUrl = `https://gateway.lighthouse.storage/ipfs/${uploadResult.unwrap()[1].hash}`;

    // 6. Generate and upload NFT metadata
    const nftConfig: MusicNFTConfig = {
      animationUrl,
      itheumCreator: params.creator ?? this.wallet.publicKey.toString(),
      itheumDataStreamUrl: `https://gateway.lighthouse.storage/ipfs/${ipnsResult.unwrap().pointingHash}?dmf-nestedstream=1`,
      imageUrl: animationUrl,
      name: params.nft.name,
      previewMusicUrl: trackUrl,
      description: params.nft.description,
      tokenCode: params.tokenCode
    };

    const encryptResult = await this.marshalManager.encrypt({
      dataNFTStreamUrl: nftConfig.itheumDataStreamUrl,
      dataCreatorSOLAddress: params.creator ?? this.wallet.publicKey.toString()
    });
    if (encryptResult.isErr()) {
      return Result.err(encryptResult.getErr());
    }
    logger.info('Encrypted data stream URL successfully');

    nftConfig.itheumDataStreamUrl = encryptResult.unwrap().encryptedMessage;

    aithraToolkitLogger.debug('Getting the Nft Metadata Builder');
    const builderNftResult = NFTMetadataBuilderFactory.getBuilder(NFTTypes.Music);
    if (builderNftResult.isErr()) {
      return Result.err(builderNftResult.getErr());
    }

    aithraToolkitLogger.debug('Building the NFT metadata');
    const metadataResult = builderNftResult.unwrap().buildMetadata(nftConfig);
    if (metadataResult.isErr()) {
      return Result.err(metadataResult.getErr());
    }
    logger.info('NFT metadata built successfully');


    const metadataPayment = await this.filesCreditManager.handlePayment(1);
    if (metadataPayment.isErr()) {
      return Result.err(metadataPayment.getErr());
    }

    const uploadedMetadata = await this.storageManager.upload({
      files: [new File([JSON.stringify(metadataResult.unwrap())], 'metadata.json')],
      category: 'staticdata',
      paymentHash: metadataPayment.unwrap(),
      address: this.wallet.publicKey.toString()
    });

    logger.info('NFT metadata uploaded successfully');


    let creators = params.referenceTrackCreator ? [
      { address: params.creator ?? this.wallet.publicKey.toString(), share: 33 },
      { address: params.referenceTrackCreator, share: 34 },
      { address: '4yWRkNB23Ee9oRw2h9SAH5nEKQndVM6y2bKDwB1zoAR1', share: 33 }
    ] : [
      { address: params.creator ?? this.wallet.publicKey.toString(), share: 50 },
      { address: '4yWRkNB23Ee9oRw2h9SAH5nEKQndVM6y2bKDwB1zoAR1', share: 50 }
    ]


    // 7. Handle minting
    const mintConfig: MintConfig = {
      mintForSolAddr: params.creator ?? this.wallet.publicKey.toString(),
      tokenName: params.nft.tokenName,
      metadataOnIpfsUrl: `https://gateway.lighthouse.storage/ipfs/${uploadedMetadata.unwrap()[0].hash}`,
      sellerFeeBasisPoints: params.nft.sellerFeeBasisPoints,
      creators,
      quantity: params.nft.quantity
    };

    const mintPaymentResult = await this.mintsCreditManager.handlePayment(params.nft.quantity);
    if (mintPaymentResult.isErr()) {
      return Result.err(mintPaymentResult.getErr());
    }

    const mintResult = await this.mintManager.mint({
      config: mintConfig,
      paymentHash: mintPaymentResult.unwrap(),
      address: this.wallet.publicKey.toString()
    });
    if (mintResult.isErr()) {
      return Result.err(mintResult.getErr());
    }

    logger.info('NFTs minted successfully');
    logger.info(
      `NFTs minted: ${mintResult.unwrap().length} with assetIds: ${mintResult.unwrap().join(', ')}`
    );

    aithraToolkitLogger.debug('Exiting buildUploadMintMusicNFTs');
    return Result.ok({
      success: true,
      assetIds: mintResult.unwrap(),
      animationUrl: animationUrl,
      trackUrl: trackUrl,
      trackImageUrl: trackImageUrl
    });
  }

  private async handleAnimation(animation: { animationUrl?: string; animationFile?: string }): Promise<Result<string, Error>> {
    aithraToolkitLogger.debug('Entering handleAnimation');
    if (animation.animationUrl) {
      return Result.ok(animation.animationUrl);
    }

    if (!animation.animationFile) {
      return Result.err(new Error('Either animationUrl or animationFile must be provided'));
    }

    const fileResult = await this.readAnimationFile(animation.animationFile);
    if (fileResult.isErr()) {
      return Result.err(fileResult.getErr());
    }

    const paymentResult = await this.filesCreditManager.handlePayment(1);
    if (paymentResult.isErr()) {
      return Result.err(paymentResult.getErr());
    }

    const uploadResult = await this.storageManager.upload({
      files: [fileResult.unwrap()],
      category: 'staticdata',
      paymentHash: paymentResult.unwrap(),
      address: this.wallet.publicKey.toString()
    });
    if (uploadResult.isErr()) {
      return Result.err(uploadResult.getErr());
    }

    aithraToolkitLogger.debug('Exiting handleAnimation');
    logger.info('Animation file uploaded successfully');
    return Result.ok(`https://gateway.lighthouse.storage/ipfs/${uploadResult.unwrap()[0].hash}`);
  }

  private async readAnimationFile(filePath: string): Promise<Result<File, Error>> {
    try {
      const fileContent = await fs.promises.readFile(filePath);
      const fileName = path.basename(filePath);
      const fileType = path.extname(fileName).toLowerCase().slice(1);

      const mimeType = this.getMimeType(fileType);
      if (!mimeType) {
        return Result.err(new Error('Unsupported animation file type'));
      }

      return Result.ok(new File([fileContent], fileName, { type: mimeType }));
    } catch (err) {
      return Result.err(new Error(`Failed to read animation file: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  private getMimeType(fileType: string): string | null {
    if (['mp4', 'webm', 'ogg'].includes(fileType)) {
      return `video/${fileType}`;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType)) {
      return `image/${fileType === 'jpg' ? 'jpeg' : fileType}`;
    }
    return null;
  }
}
