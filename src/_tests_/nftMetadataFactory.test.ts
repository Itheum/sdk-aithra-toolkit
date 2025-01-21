// nft-metadata-builder.test.ts
import {
  NFTMetadataBuilderFactory,
  MusicNFTMetadataBuilder
} from '../core/nftMetadataFactory';
import { NFTType, MusicNFTConfig } from '../core/types';

describe('NFTMetadataBuilderFactory', () => {
  it('should return MusicNFTMetadataBuilder for Music type', () => {
    const builder = NFTMetadataBuilderFactory.getBuilder(NFTType.Music);
    expect(builder).toBeInstanceOf(MusicNFTMetadataBuilder);
  });

  it('should throw error for invalid NFT type', () => {
    expect(() => {
      NFTMetadataBuilderFactory.getBuilder('invalid' as NFTType);
    }).toThrow('No builder found for NFT type: invalid');
  });
});

describe('MusicNFTMetadataBuilder', () => {
  let builder: MusicNFTMetadataBuilder;
  let validConfig: MusicNFTConfig;

  beforeEach(() => {
    builder = new MusicNFTMetadataBuilder();
    validConfig = {
      animationUrl: 'https://arweave.net/example-mp3',
      itheumCreator: 'Enh4wN39eKZ4xWAcKZCCVdxEnRCfVWkjaNT9aPDXS9nH',
      itheumDataStreamUrl: 'encoded-data-stream-url',
      tokenCode: 'MUSG2',
      description: 'Dark Hip Hop Instrumentals Common Album',
      imageUrl: 'https://arweave.net/example-gif',
      name: 'MUSG2 - Cranium Beats'
    };
  });

  describe('validateConfig', () => {
    const requiredFields = [
      'animationUrl',
      'itheumCreator',
      'itheumDataStreamUrl',
      'tokenCode',
      'description',
      'imageUrl',
      'name'
    ];

    requiredFields.forEach((field) => {
      it(`should throw error when ${field} is missing`, () => {
        const invalidConfig = { ...validConfig };
        delete invalidConfig[field as keyof MusicNFTConfig];

        expect(() => {
          builder.buildMetadata(invalidConfig);
        }).toThrow(`Missing required field: ${field}`);
      });

      it(`should throw error when ${field} is empty`, () => {
        const invalidConfig = {
          ...validConfig,
          [field]: ''
        };

        expect(() => {
          builder.buildMetadata(invalidConfig);
        }).toThrow(`Missing required field: ${field}`);
      });
    });
  });

  describe('buildMetadata', () => {
    it('should build metadata with required fields and default values', () => {
      const metadata = builder.buildMetadata(validConfig);

      expect(metadata).toMatchObject({
        animation_url: validConfig.animationUrl,
        description: validConfig.description,
        external_url: 'https://itheum.io/music',
        image: validConfig.imageUrl,
        name: validConfig.name,
        symbol: ''
      });

      // Check default attributes
      expect(metadata.attributes).toContainEqual({
        trait_type: 'App',
        value: 'itheum.io/music'
      });
      expect(metadata.attributes).toContainEqual({
        trait_type: 'ItheumDrop',
        value: '20' // Default value
      });
      expect(metadata.attributes).toContainEqual({
        trait_type: 'Rarity',
        value: 'Common' // Default value
      });
    });

    it('should include additional traits when provided', () => {
      const configWithTraits = {
        ...validConfig,
        additionalTraits: [
          {
            trait_type: 'Artist',
            value: 'YFGP'
          }
        ]
      };

      const metadata = builder.buildMetadata(configWithTraits);

      expect(metadata.attributes).toContainEqual({
        trait_type: 'Artist',
        value: 'YFGP'
      });
    });

    it('should override default values when provided', () => {
      const configWithOverrides = {
        ...validConfig,
        itheumDrop: '30',
        rarity: 'Rare'
      };

      const metadata = builder.buildMetadata(configWithOverrides);

      expect(metadata.attributes).toContainEqual({
        trait_type: 'ItheumDrop',
        value: '30'
      });
      expect(metadata.attributes).toContainEqual({
        trait_type: 'Rarity',
        value: 'Rare'
      });
    });

    it('should correctly structure properties and files', () => {
      const metadata = builder.buildMetadata(validConfig);

      expect(metadata.properties).toEqual({
        category: 'audio',
        files: [
          {
            type: 'image/gif',
            uri: validConfig.imageUrl
          },
          {
            type: 'audio/mpeg',
            uri: validConfig.animationUrl
          }
        ]
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty additional traits array', () => {
      const configWithEmptyTraits = {
        ...validConfig,
        additionalTraits: []
      };

      const metadata = builder.buildMetadata(configWithEmptyTraits);
      // Should only contain base attributes (7)
      expect(metadata.attributes.length).toBe(7);
    });

    it('should handle undefined additional traits', () => {
      const configWithUndefinedTraits = {
        ...validConfig,
        additionalTraits: undefined
      };

      const metadata = builder.buildMetadata(configWithUndefinedTraits);
      expect(metadata.attributes.length).toBe(7);
    });

    it('should maintain attribute order', () => {
      const metadata = builder.buildMetadata(validConfig);

      const expectedOrder = [
        'App',
        'ItheumDrop',
        'Type',
        'itheum_creator',
        'itheum_data_stream_url',
        'Rarity',
        'TokenCode'
      ];

      const actualOrder = metadata.attributes.map((attr) => attr.trait_type);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it('should handle multiple additional traits', () => {
      const configWithMultipleTraits = {
        ...validConfig,
        additionalTraits: [
          {
            trait_type: 'Artist',
            value: 'YFGP'
          },
          {
            trait_type: 'Genre',
            value: 'Hip Hop'
          },
          {
            trait_type: 'BPM',
            value: '90'
          }
        ]
      };

      const metadata = builder.buildMetadata(configWithMultipleTraits);
      expect(metadata.attributes.length).toBe(10); // 7 base + 3 additional
      expect(metadata.attributes).toContainEqual({
        trait_type: 'Artist',
        value: 'YFGP'
      });
      expect(metadata.attributes).toContainEqual({
        trait_type: 'Genre',
        value: 'Hip Hop'
      });
      expect(metadata.attributes).toContainEqual({
        trait_type: 'BPM',
        value: '90'
      });
    });
  });
});
