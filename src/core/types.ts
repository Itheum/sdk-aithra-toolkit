export interface BaseManifest {
  data_stream: {
    category: string;
    name: string;
    creator: string;
    created_on: string;
    last_modified_on: string;
    marshalManifest: {
      totalItems: number;
      nestedStream: boolean;
    };
  };
  data: unknown[];
}

export interface MusicPlaylistConfig {
  name: string;
  creator: string;
  filesMetadata?: Record<string, FileMetadata>;
  defaultMetadata?: {
    artist: string;
    album: string;
  };
}

export interface FileMetadata {
  artist: string;
  album: string;
}

export interface MusicPlaylistManifest extends BaseManifest {
  data: Array<{
    idx: number;
    date: string;
    category: string;
    artist: string;
    album: string;
    cover_art_url: string;
    title: string;
  }>;
}

export type UploadedFile = {
  hash: string;
  fileName: string;
  mimeType: string;
  folderHash: string;
  category: string;
};

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
