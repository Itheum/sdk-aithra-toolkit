export interface DataStream {
  category: string;
  name: string;
  creator: string;
  created_on: string;
  last_modified_on: string;
  marshalManifest: {
    totalItems: number;
    nestedStream: boolean;
  };
}

// Base manifest interface
export interface BaseManifest<T = unknown> {
  data_stream: DataStream;
  data: T[];
}

export interface MusicTrackData {
  idx: number;
  date: string;
  category: string;
  artist: string;
  album: string;
  src: string;
  cover_art_url: string;
  title: string;
}

export interface MusicPlaylistManifest extends BaseManifest<MusicTrackData> {}

export interface FileMetadata {
  artist: string;
  album: string;
  title: string;
  category: string;
}

export type UploadedFile = {
  hash: string;
  fileName: string;
  mimeType: string;
  folderHash: string;
  category: string;
};

export interface MusicPlaylistConfig {
  name: string;
  creator: string;
  filesMetadata: Record<string, FileMetadata>;
  fileNames: Record<
    string,
    {
      audioFileName: string;
      coverArtFileName: string;
    }
  >;
  defaultMetadata?: {
    album: string;
    category: string;
  };
}

export enum ManifestType {
  MusicPlaylist = 'musicplaylist'
}

export interface IManifestBuilder {
  buildManifest(
    type: ManifestType,
    files: UploadedFile[],
    musicPlaylistConfig: MusicPlaylistConfig
  ): Promise<BaseManifest>;
}

export interface IManifestBuilder {
  buildManifest(
    type: ManifestType,
    uploadedFiles: UploadedFile[],
    config: any
  ): Promise<BaseManifest>;
}
export interface Logger {
  closeByNewLine?: boolean;
  useIcons?: boolean;
  verbose?: boolean;
  log: (...strings: any[]) => void;
  warn: (...strings: any[]) => void;
  error: (...strings: any[]) => void;
  info: (...strings: any[]) => void;
  success: (...strings: any[]) => void;
  debug: (...strings: any[]) => void;
}

export interface ICreditManager {
  handlePayment(numberOfFiles: number): Promise<string>;
}

export interface IStorageManagerParams {
  files: File | File[];
  category: 'files' | 'staticdata' | ManifestType;
  paymentHash: string;
  address: string;
}

export interface IpnsResponse {
  key: string;
  hash: string;
  address: string;
  pointingHash: string;
  lastUpdated: number;
}

export interface IStorageManager {
  upload(params: IStorageManagerParams): Promise<UploadedFile[]>;
  pinToIpns(cid: string, address: string): Promise<IpnsResponse>;
}

export interface IMarshalManager {
  encrypt(params: IEncryptParams): Promise<IEncryptResponse>;
  decrypt(params: IMarshalDecryptParams): Promise<IMarshalDecryptResponse>;
}

export interface IEncryptParams {
  dataNFTStreamUrl: string;
  dataCreatorERDAddress?: string;
  dataCreatorSOLAddress?: string;
}

export interface IEncryptResponse {
  encryptedMessage: string;
  messageHash: string;
}

export interface IMarshalDecryptParams {
  encryptedMessage: string;
}

export interface IMarshalDecryptResponse {
  [key: string]: any;
}

// Nft related

export enum NFTType {
  Music = 'music'
  // Future types can be added here
  // Art = 'art',
  // Video = 'video',
  // etc.
}

export interface BaseNFTMetadata {
  animation_url: string;
  attributes: NFTAttribute[];
  description: string;
  external_url: string;
  image: string;
  name: string;
  properties: {
    category: string;
    files: NFTFile[];
  };
  symbol: string;
}

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export interface NFTFile {
  type: string;
  uri: string;
}

export interface MusicNFTConfig {
  animationUrl: string;
  itheumCreator: string;
  itheumDataStreamUrl: string;
  tokenCode: string;
  description: string;
  imageUrl: string;
  name: string;
  additionalTraits?: NFTAttribute[];
  itheumDrop?: string;
  rarity?: string;
}

export interface INFTMetadataBuilder {
  buildMetadata(config: any): BaseNFTMetadata;
}
