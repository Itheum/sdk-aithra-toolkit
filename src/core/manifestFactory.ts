import {
  BaseManifest,
  IManifestBuilder,
  ManifestType,
  MusicPlaylistConfig,
  MusicPlaylistManifest,
  UploadedFile
} from './types';

export class ManifestBuilderFactory {
  static getBuilder(type: ManifestType): IManifestBuilder {
    switch (type) {
      case ManifestType.MusicPlaylist:
        return new MusicPlaylistBuilder();
      default:
        throw new Error(`No builder found for manifest type: ${type}`);
    }
  }
}

export class MusicPlaylistBuilder implements IManifestBuilder {
  buildManifest(
    type: ManifestType,
    uploadedFiles: UploadedFile[],
    config: MusicPlaylistConfig
  ): Promise<BaseManifest> {
    const now = new Date().toISOString();
    const date = now.split('T')[0];
    const musicConfig = config as MusicPlaylistConfig;

    const fileMap = uploadedFiles.reduce(
      (acc, file) => {
        acc[file.fileName] = file;
        return acc;
      },
      {} as Record<string, UploadedFile>
    );

    return Promise.resolve({
      data_stream: {
        category: type,
        name: musicConfig.name,
        creator: musicConfig.creator,
        created_on: date,
        last_modified_on: date,
        marshalManifest: {
          totalItems: Object.keys(musicConfig.filesMetadata).length,
          nestedStream: true
        }
      },
      data: Object.entries(musicConfig.filesMetadata).map(
        ([key, metadata], index) => {
          const fileNames = musicConfig.fileNames[key];

          if (!fileNames) {
            throw new Error(`File names not found for key: ${key}`);
          }

          const audioFile = fileMap[fileNames.audioFileName];
          const coverArtFile = fileMap[fileNames.coverArtFileName];

          if (!audioFile) {
            throw new Error(`Audio file not found: ${fileNames.audioFileName}`);
          }
          if (!coverArtFile) {
            throw new Error(
              `Cover art file not found: ${fileNames.coverArtFileName}`
            );
          }

          return {
            idx: index + 1,
            date: now,
            category:
              metadata.category ||
              musicConfig.defaultMetadata?.category ||
              'Unknown',
            artist: metadata.artist,
            album:
              metadata.album || musicConfig.defaultMetadata?.album || 'Unknown',
            cover_art_url: `https://gateway.lighthouse.storage/ipfs/${coverArtFile.hash}`,
            src: `https://gateway.lighthouse.storage/ipfs/${audioFile.hash}`,
            title: metadata.title
          };
        }
      )
    });
  }
}

// Example usage:
// const config: MusicPlaylistConfig = {
//   name: "Galaxy",
//   creator: "Ben",
//   filesMetadata: {
//     "cosmic_spark": {
//       artist: "Gravity Pulse",
//       album: "Suno",
//       title: "Cosmic Spark",
//       category: "Electro pop"
//     }
//   },
//   fileNames: {
//     "cosmic_spark": {
//       audioFileName: "cosmic_spark.mp3",
//       coverArtFileName: "cosmic_spark_cover.jpeg"
//     }
//   },
//   defaultMetadata: {
//     album: "Suno",
//     category: "Electronic"
//   }
// };
