/**
 * Represents a data stream with metadata and manifest information
 */
export interface DataStream {
  /** Category of the data stream */
  category: string;
  /** Name of the data stream */
  name: string;
  /** Creator of the data stream */
  creator: string;
  /** Creation timestamp */
  created_on: string;
  /** Last modification timestamp */
  last_modified_on: string;
  /** Manifest details containing item count and nesting information */
  marshalManifest: {
    totalItems: number;
    nestedStream: boolean;
  };
}

/**
 * Generic base manifest interface that contains a data stream and array of data
 */
export interface BaseManifest<T = unknown> {
  data_stream: DataStream;
  data: T[];
}

/**
 * Represents a single music track's information
 */
export interface MusicTrackData {
  /** Track index in playlist */
  idx: number;
  /** Track release date */
  date: string;
  /** Music category/genre */
  category: string;
  /** Track artist */
  artist: string;
  /** Album name */
  album: string;
  /** Audio file source URL */
  src: string;
  /** Album artwork URL */
  cover_art_url: string;
  /** Track title */
  title: string;
}

/**
 * Specialized manifest for music playlists
 */
export interface MusicPlaylistManifest extends BaseManifest<MusicTrackData> {}

/**
 * Basic metadata for music files
 */
export interface FileMetadata {
  artist: string;
  album: string;
  title: string;
  category: string;
}

/**
 * Represents an uploaded file with storage details on a decentralized network
 */
export type UploadedFile = {
  /** File hash identifier */
  hash: string;
  /** Original filename */
  fileName: string;
  /** File's MIME type */
  mimeType: string;
  /** Storage folder hash */
  folderHash: string;
  /** File category */
  category: string;
};

/**
 * Configuration for creating a music playlist
 */
export interface MusicPlaylistConfig {
  /** Playlist name */
  name: string;
  /** Playlist creator */
  creator: string;
  /** Metadata for each file, keyed by file identifier */
  filesMetadata: Record<string, FileMetadata>;
  /** File naming configuration for audio and cover art */
  fileNames: Record<
    string,
    {
      audioFileName: string;
      coverArtFileName: string;
    }
  >;
  /** Default metadata to apply when individual file metadata is missing */
  defaultMetadata?: {
    album: string;
    category: string;
  };
}

/**
 * Available manifest types
 */
export enum ManifestType {
  MusicPlaylist = 'musicplaylist'
}

/**
 * Maps manifest types to their corresponding config types
 */
export type ManifestConfigMap = {
  [ManifestType.MusicPlaylist]: MusicPlaylistConfig;
  // Add new manifest types here with their configs
};

/**
 * Interface for building manifests from uploaded files and configuration
 */
export interface IManifestBuilder {
  buildManifest<T extends ManifestType>(
    type: T,
    files: UploadedFile[],
    config: ManifestConfigMap[T]
  ): Promise<BaseManifest>;
}

/**
 * Logging interface with configurable options
 */
export interface Logger {
  /** Whether to add newline after logs */
  closeByNewLine?: boolean;
  /** Whether to use icons in logs */
  useIcons?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  log: (...strings: any[]) => void;
  warn: (...strings: any[]) => void;
  error: (...strings: any[]) => void;
  info: (...strings: any[]) => void;
  success: (...strings: any[]) => void;
  debug: (...strings: any[]) => void;
}

/**
 * Handles payment processing for file operations
 */
export interface ICreditManager {
  handlePayment(numberOfFiles: number): Promise<string>;
}

/**
 * Parameters for storage operations
 */
export interface IStorageManagerParams {
  /** Files to store */
  files: File | File[];
  /** Storage category */
  category: 'files' | 'staticdata' | ManifestType;
  /** Payment transaction hash */
  paymentHash: string;
  /** Storage address */
  address: string;
}

/**
 * Response from IPNS operations
 */
export interface IpnsResponse {
  /** IPNS key */
  key: string;
  /** Content hash */
  hash: string;
  /** IPNS address */
  address: string;
  /** Hash being pointed to */
  pointingHash: string;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Interface for managing file storage operations
 */
export interface IStorageManager {
  upload(params: IStorageManagerParams): Promise<UploadedFile[]>;
  pinToIpns(cid: string, address: string): Promise<IpnsResponse>;
}

/**
 * Interface for encryption and decryption operations
 */
export interface IMarshalManager {
  encrypt(params: IEncryptParams): Promise<IEncryptResponse>;
  decrypt(params: IMarshalDecryptParams): Promise<IMarshalDecryptResponse>;
}

/**
 * Parameters for encryption operations
 */
export interface IEncryptParams {
  /** URL of the data NFT stream */
  dataNFTStreamUrl: string;
  /** Optional ERD address of data creator */
  dataCreatorERDAddress?: string;
  /** Optional SOL address of data creator */
  dataCreatorSOLAddress?: string;
}

/**
 * Response from encryption operations
 */
export interface IEncryptResponse {
  /** Encrypted message content */
  encryptedMessage: string;
  /** Hash of the message */
  messageHash: string;
}

/**
 * Parameters for decryption operations
 */
export interface IMarshalDecryptParams {
  /** Encrypted message to decrypt */
  encryptedMessage: string;
}

/**
 * Response from decryption operations
 */
export interface IMarshalDecryptResponse {
  [key: string]: any;
}

/** Available NFT types in the system */
export const NFTTypes = {
  Music: 'music'
} as const;

/** Union type of all available NFT types */
export type NFTType = (typeof NFTTypes)[keyof typeof NFTTypes];

/** Base metadata structure that all NFT types must implement */
export interface NFTMetadataBase {
  /** URL pointing to animated content */
  animation_url: string;
  /** NFT description */
  description: string;
  /** External reference URL */
  external_url: string;
  /** NFT image URL */
  image: string;
  /** NFT name */
  name: string;
  /** NFT symbol/ticker */
  symbol: string;
  /** Array of NFT traits/attributes */
  attributes: Array<{ trait_type: string; value: string }>;
  /** Additional NFT properties */
  properties: {
    /** NFT category identifier */
    category: string;
    /** Associated files */
    files: Array<{ type: string; uri: string }>;
  };
}

/** Metadata structure specific to Music NFTs */
export interface MusicNFTMetadata extends NFTMetadataBase {
  properties: {
    /** Fixed category for music NFTs */
    category: 'audio';
    /** Array of music-specific file types */
    files: Array<{ type: 'image/gif' | 'audio/mpeg'; uri: string }>;
  };
}

/** Base configuration required for all NFT types */
export interface NFTConfigBase {
  /** URL for animated content */
  animationUrl: string;
  /** Creator identifier */
  itheumCreator: string;
  /** Data stream URL */
  itheumDataStreamUrl: string;
  /** Image URL */
  imageUrl: string;
  /** NFT name */
  name: string;
  /** NFT description */
  description: string;
  /** Additional NFT traits */
  additionalTraits?: Array<{ trait_type: string; value: string }>;
}

/** Configuration specific to Music NFTs */
export interface MusicNFTConfig extends NFTConfigBase {
  /** Token identifier code */
  tokenCode?: string;
  /** Drop identifier */
  itheumDrop?: string;
  /** Preview music url */
  previewMusicUrl?: string;
  /** Optional rarity level */
  rarity?: string;
}

/** Generic builder interface for creating NFT metadata */
export interface INFTMetadataBuilder<T extends NFTType> {
  /** Builds metadata for a specific NFT type based on provided configuration */
  buildMetadata(
    config: T extends typeof NFTTypes.Music ? MusicNFTConfig : never
  ): T extends typeof NFTTypes.Music ? MusicNFTMetadata : never;
}
/**
 * Configuration for minting NFTs
 */
export interface MintConfig {
  /** Solana address to mint for */
  mintForSolAddr: string;
  /** Token name */
  tokenName: string;
  /** IPFS URL for metadata */
  metadataOnIpfsUrl: string;
  /** Seller fee in basis points */
  sellerFeeBasisPoints: number;
  /** Creator addresses and share percentages */
  creators: Array<{
    address: string;
    share: number;
  }>;
  /** Number of tokens to mint */
  quantity: number;
}

/**
 * Parameters for minting operations
 */
export interface MintManagerParams {
  /** Mint configuration */
  config: MintConfig;
  /** Minting address */
  address: string;
  /** Payment transaction hash */
  paymentHash: string;
}

/**
 * Interface for managing NFT minting operations
 */
export interface IMintManager {
  mint(params: MintManagerParams): Promise<string[]>;
}

export type TrackInfo = Array<{
  [trackName: string]: {
    metadata: {
      artist: string;
      album: string;
      title: string;
      category: string;
    };
  };
}>;
