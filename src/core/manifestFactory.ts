import { Result } from '../result';
import { aithraToolkitLogger } from './logger';
import {
  BaseManifest,
  IManifestBuilder,
  ManifestType,
  MusicPlaylistConfig,
  MusicPlaylistManifest,
  UploadedFile
} from './types';

export class ManifestBuilderFactory {
  static getBuilder(type: ManifestType): Result<IManifestBuilder, Error> {
    switch (type) {
      case ManifestType.MusicPlaylist:
        return Result.ok(new MusicPlaylistBuilder());
      default:
        return Result.err(new Error(`No builder found for manifest type: ${type}`));
    }
  }
}

export class MusicPlaylistBuilder implements IManifestBuilder {
  async buildManifest(
    type: ManifestType,
    uploadedFiles: UploadedFile[],
    config: MusicPlaylistConfig
  ): Promise<Result<MusicPlaylistManifest, Error>> {
    aithraToolkitLogger.debug('Entering buildManifest');
    try {
      const now = new Date().toISOString();
      const date = now.split('T')[0];

      const fileMap = uploadedFiles.reduce(
        (acc, file) => {
          acc[file.fileName] = file;
          return acc;
        },
        {} as Record<string, UploadedFile>
      );

      const manifest: MusicPlaylistManifest = {
        data_stream: {
          category: type,
          name: config.name,
          creator: config.creator,
          created_on: date,
          last_modified_on: date,
          marshalManifest: {
            totalItems: Object.keys(config.filesMetadata).length,
            nestedStream: true
          }
        },
        data: []
      };

      // Process each track
      for (const [key, metadata] of Object.entries(config.filesMetadata)) {
        const fileNames = config.fileNames[key];
        if (!fileNames) {
          return Result.err(new Error(`File names not found for key: ${key}`));
        }

        const audioFile = fileMap[fileNames.audioFileName];
        const coverArtFile = fileMap[fileNames.coverArtFileName];

        if (!audioFile) {
          return Result.err(new Error(`Audio file not found: ${fileNames.audioFileName}`));
        }
        if (!coverArtFile) {
          return Result.err(new Error(`Cover art file not found: ${fileNames.coverArtFileName}`));
        }

        manifest.data.push({
          idx: manifest.data.length + 1,
          date: now,
          category: metadata.category || config.defaultMetadata?.category || 'Unknown',
          artist: metadata.artist,
          album: metadata.album || config.defaultMetadata?.album || 'Unknown',
          cover_art_url: `https://gateway.lighthouse.storage/ipfs/${coverArtFile.hash}`,
          file: `https://gateway.lighthouse.storage/ipfs/${audioFile.hash}`,
          title: metadata.title
        });
      }
      aithraToolkitLogger.debug('Exiting buildManifest');
      return Result.ok(manifest);
    } catch (err) {
      return Result.err(
        new Error(`Failed to build manifest: ${err instanceof Error ? err.message : String(err)}`)
      );
    }
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
