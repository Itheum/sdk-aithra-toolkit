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
