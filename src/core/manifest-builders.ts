import {
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
  async buildManifest(
    type: ManifestType,
    files: UploadedFile[],
    musicPlaylistConfig: MusicPlaylistConfig
  ): Promise<MusicPlaylistManifest> {
    const now = new Date().toISOString();
    const date = now.split('T')[0];

    return {
      data_stream: {
        category: type,
        name: musicPlaylistConfig.name,
        creator: musicPlaylistConfig.creator,
        created_on: date,
        last_modified_on: date,
        marshalManifest: {
          totalItems: files.length,
          nestedStream: true
        }
      },
      data: files.map((file, index) => {
        const fileMetadata = musicPlaylistConfig.filesMetadata?.[file.fileName];
        return {
          idx: index + 1,
          date: now,
          category: file.category,
          artist:
            fileMetadata?.artist ||
            musicPlaylistConfig.defaultMetadata?.artist ||
            'Unknown',
          album:
            fileMetadata?.album ||
            musicPlaylistConfig.defaultMetadata?.album ||
            'Unknown',
          cover_art_url: `https://gateway.lighthouse.storage/ipfs/${file.hash}`,
          title: file.fileName
        };
      })
    };
  }
}

/// Usage:
// const config: MusicPlaylistConfig = {
//   name: "Galaxy",
//   creator: "Ben",
//   filesMetadata: {
//     "cosmic_spark.mp3": {
//       artist: "Gravity Pulse",
//       album: "Suno"
//     }
//   }
// };
//
// const builder = ManifestBuilderFactory.getBuilder(ManifestType.MusicPlaylist);
// const manifest = await builder.buildManifest(type, uploadedFiles, config);
//
