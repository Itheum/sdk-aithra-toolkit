import {
  ManifestBuilderFactory,
  MusicPlaylistBuilder
} from '../core/manifest-builders';
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
    // Mock the date to ensure consistent testing
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
      hash: 'Qm987654321',
      fileName: 'stellar_dance.mp3',
      mimeType: 'audio/mpeg',
      folderHash: 'Qm987654321',
      category: ManifestType.MusicPlaylist
    }
  ];

  const baseConfig: MusicPlaylistConfig = {
    name: 'Galaxy',
    creator: 'Ben'
  };

  it('should build basic manifest without metadata', async () => {
    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      baseConfig
    )) as MusicPlaylistManifest;

    expect(manifest).toEqual({
      data_stream: {
        category: ManifestType.MusicPlaylist,
        name: 'Galaxy',
        creator: 'Ben',
        created_on: '2024-01-18',
        last_modified_on: '2024-01-18',
        marshalManifest: {
          totalItems: 2,
          nestedStream: true
        }
      },
      data: [
        {
          idx: 1,
          date: mockDate,
          category: ManifestType.MusicPlaylist,
          artist: 'Unknown',
          album: 'Unknown',
          cover_art_url: `https://gateway.lighthouse.storage/ipfs/${mockFiles[0].hash}`,
          title: 'cosmic_spark.mp3'
        },
        {
          idx: 2,
          date: mockDate,
          category: ManifestType.MusicPlaylist,
          artist: 'Unknown',
          album: 'Unknown',
          cover_art_url: `https://gateway.lighthouse.storage/ipfs/${mockFiles[1].hash}`,
          title: 'stellar_dance.mp3'
        }
      ]
    });
  });

  it('should build manifest with file-specific metadata', async () => {
    const configWithMetadata: MusicPlaylistConfig = {
      ...baseConfig,
      filesMetadata: {
        'cosmic_spark.mp3': {
          artist: 'Gravity Pulse',
          album: 'Suno'
        }
      }
    };

    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      configWithMetadata
    )) as MusicPlaylistManifest;

    expect(manifest.data[0]).toEqual({
      idx: 1,
      date: mockDate,
      category: ManifestType.MusicPlaylist,
      artist: 'Gravity Pulse',
      album: 'Suno',
      cover_art_url: `https://gateway.lighthouse.storage/ipfs/${mockFiles[0].hash}`,
      title: 'cosmic_spark.mp3'
    });

    // Second file should still have default values
    expect(manifest.data[1].artist).toBe('Unknown');
    expect(manifest.data[1].album).toBe('Unknown');
  });

  it('should build manifest with default metadata', async () => {
    const configWithDefaults: MusicPlaylistConfig = {
      ...baseConfig,
      defaultMetadata: {
        artist: 'Default Artist',
        album: 'Default Album'
      }
    };

    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      configWithDefaults
    )) as MusicPlaylistManifest;

    // Both files should have default metadata
    manifest.data.forEach((item) => {
      expect(item.artist).toBe('Default Artist');
      expect(item.album).toBe('Default Album');
    });
  });

  it('should prioritize file-specific metadata over default metadata', async () => {
    const configWithBoth: MusicPlaylistConfig = {
      ...baseConfig,
      defaultMetadata: {
        artist: 'Default Artist',
        album: 'Default Album'
      },
      filesMetadata: {
        'cosmic_spark.mp3': {
          artist: 'Gravity Pulse',
          album: 'Suno'
        }
      }
    };

    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      configWithBoth
    )) as MusicPlaylistManifest;

    // First file should have specific metadata
    expect(manifest.data[0]).toEqual({
      idx: 1,
      date: mockDate,
      category: ManifestType.MusicPlaylist,
      artist: 'Gravity Pulse',
      album: 'Suno',
      cover_art_url: `https://gateway.lighthouse.storage/ipfs/${mockFiles[0].hash}`,
      title: 'cosmic_spark.mp3'
    });

    // Second file should have default metadata
    expect(manifest.data[1]).toEqual({
      idx: 2,
      date: mockDate,
      category: ManifestType.MusicPlaylist,
      artist: 'Default Artist',
      album: 'Default Album',
      cover_art_url: `https://gateway.lighthouse.storage/ipfs/${mockFiles[1].hash}`,
      title: 'stellar_dance.mp3'
    });
  });

  it('should handle empty files array', async () => {
    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      [],
      baseConfig
    )) as MusicPlaylistManifest;

    expect(manifest.data_stream.marshalManifest.totalItems).toBe(0);
    expect(manifest.data).toEqual([]);
  });

  it('should generate correct cover art URLs', async () => {
    const manifest = (await builder.buildManifest(
      ManifestType.MusicPlaylist,
      mockFiles,
      baseConfig
    )) as MusicPlaylistManifest;

    manifest.data.forEach((item, index) => {
      expect(item.cover_art_url).toBe(
        `https://gateway.lighthouse.storage/ipfs/${mockFiles[index].hash}`
      );
    });
  });
});
