import {
  ManifestBuilderFactory,
  MusicPlaylistBuilder
} from '../core/manifestFactory';
import {
  ManifestType,
  MusicPlaylistConfig,
  MusicPlaylistManifest,
  UploadedFile,
  BaseManifest
} from '../core/types';

describe('ManifestBuilderFactory', () => {
  it('should return MusicPlaylistBuilder for MusicPlaylist type', () => {
    const builder = ManifestBuilderFactory.getBuilder(
      ManifestType.MusicPlaylist
    );
    expect(builder).toBeInstanceOf(MusicPlaylistBuilder);
  });

  it('should throw error for unsupported manifest type', () => {
    expect(() =>
      ManifestBuilderFactory.getBuilder('unsupported' as ManifestType)
    ).toThrow('No builder found for manifest type: unsupported');
  });
});

describe('MusicPlaylistBuilder', () => {
  let builder: MusicPlaylistBuilder;
  let mockDate: string;

  beforeEach(() => {
    builder = new MusicPlaylistBuilder();
    mockDate = '2024-01-18T12:00:00.000Z';
    jest.useFakeTimers();
    jest.setSystemTime(new Date(mockDate));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockFiles: UploadedFile[] = [
    {
      hash: 'Qm123456789',
      fileName: 'cosmic_spark.mp3',
      mimeType: 'audio/mpeg',
      folderHash: 'Qm987654321',
      category: ManifestType.MusicPlaylist
    },
    {
      hash: 'Qm234567890',
      fileName: 'cosmic_spark_cover.jpeg',
      mimeType: 'image/jpeg',
      folderHash: 'Qm987654321',
      category: ManifestType.MusicPlaylist
    },
    {
      hash: 'Qm345678901',
      fileName: 'stellar_dance.mp3',
      mimeType: 'audio/mpeg',
      folderHash: 'Qm987654321',
      category: ManifestType.MusicPlaylist
    },
    {
      hash: 'Qm456789012',
      fileName: 'stellar_dance_cover.jpeg',
      mimeType: 'image/jpeg',
      folderHash: 'Qm987654321',
      category: ManifestType.MusicPlaylist
    }
  ];

  const baseConfig: MusicPlaylistConfig = {
    name: 'Galaxy',
    creator: 'Ben',
    filesMetadata: {
      cosmic_spark: {
        artist: 'Gravity Pulse',
        album: 'Suno',
        title: 'Cosmic Spark',
        category: 'Electro pop'
      },
      stellar_dance: {
        artist: 'Star Beats',
        album: 'Suno',
        title: 'Stellar Dance',
        category: 'Electro pop'
      }
    },
    fileNames: {
      cosmic_spark: {
        audioFileName: 'cosmic_spark.mp3',
        coverArtFileName: 'cosmic_spark_cover.jpeg'
      },
      stellar_dance: {
        audioFileName: 'stellar_dance.mp3',
        coverArtFileName: 'stellar_dance_cover.jpeg'
      }
    }
  };

  it('should build manifest with complete metadata and files', async () => {
    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      baseConfig
    )) as MusicPlaylistManifest;

    expect(manifest.data_stream).toEqual({
      category: ManifestType.MusicPlaylist,
      name: 'Galaxy',
      creator: 'Ben',
      created_on: '2024-01-18',
      last_modified_on: '2024-01-18',
      marshalManifest: {
        totalItems: 2,
        nestedStream: true
      }
    });

    expect(manifest.data).toEqual([
      {
        idx: 1,
        date: mockDate,
        category: 'Electro pop',
        artist: 'Gravity Pulse',
        album: 'Suno',
        src: `https://gateway.lighthouse.storage/ipfs/Qm123456789`,
        cover_art_url: `https://gateway.lighthouse.storage/ipfs/Qm234567890`,
        title: 'Cosmic Spark'
      },
      {
        idx: 2,
        date: mockDate,
        category: 'Electro pop',
        artist: 'Star Beats',
        album: 'Suno',
        src: `https://gateway.lighthouse.storage/ipfs/Qm345678901`,
        cover_art_url: `https://gateway.lighthouse.storage/ipfs/Qm456789012`,
        title: 'Stellar Dance'
      }
    ]);
  });

  it('should use default metadata when file-specific metadata fields are missing', async () => {
    const configWithDefaults: MusicPlaylistConfig = {
      name: 'Galaxy',
      creator: 'Ben',
      filesMetadata: {
        cosmic_spark: {
          artist: 'Gravity Pulse',
          title: 'Cosmic Spark',
          album: '', // Missing album
          category: '' // Missing category
        },
        stellar_dance: {
          artist: 'Star Beats',
          title: 'Stellar Dance',
          album: '', // Missing album
          category: '' // Missing category
        }
      },
      fileNames: {
        cosmic_spark: {
          audioFileName: 'cosmic_spark.mp3',
          coverArtFileName: 'cosmic_spark_cover.jpeg'
        },
        stellar_dance: {
          audioFileName: 'stellar_dance.mp3',
          coverArtFileName: 'stellar_dance_cover.jpeg'
        }
      },
      defaultMetadata: {
        album: 'Default Album',
        category: 'Default Category'
      }
    };

    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      configWithDefaults
    )) as MusicPlaylistManifest;

    expect(manifest.data[0].album).toBe('Default Album');
    expect(manifest.data[0].category).toBe('Default Category');
    expect(manifest.data[1].album).toBe('Default Album');
    expect(manifest.data[1].category).toBe('Default Category');
  });

  it('should throw error when audio file is missing', async () => {
    const incompleteFiles = mockFiles.filter(
      (file) => !file.fileName.includes('cosmic_spark.mp3')
    );

    await expect(async () => {
      await builder.buildManifest(
        ManifestType.MusicPlaylist,
        incompleteFiles,
        baseConfig
      );
    }).rejects.toThrow('Audio file not found: cosmic_spark.mp3');
  });

  it('should throw error when cover art file is missing', async () => {
    const incompleteFiles = mockFiles.filter(
      (file) => !file.fileName.includes('cosmic_spark_cover.jpeg')
    );

    await expect(async () => {
      await builder.buildManifest(
        ManifestType.MusicPlaylist,
        incompleteFiles,
        baseConfig
      );
    }).rejects.toThrow('Cover art file not found: cosmic_spark_cover.jpeg');
  });

  it('should handle empty metadata object', async () => {
    const emptyConfig: MusicPlaylistConfig = {
      name: 'Galaxy',
      creator: 'Ben',
      filesMetadata: {},
      fileNames: {}
    };

    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      emptyConfig
    )) as MusicPlaylistManifest;

    expect(manifest.data_stream.marshalManifest.totalItems).toBe(0);
    expect(manifest.data).toEqual([]);
  });
});
