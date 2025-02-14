import { Result } from '../result';
import {
  INFTMetadataBuilder,
  MusicNFTConfig,
  MusicNFTMetadata,
  NFTType,
  NFTTypes
} from './types';


type NFTBuilderMap = {
  [NFTTypes.Music]: {
    config: MusicNFTConfig;
    metadata: MusicNFTMetadata;
  };
  // Add other NFT types here following the same pattern
};

export class NFTMetadataBuilderFactory {
  static getBuilder<T extends keyof NFTBuilderMap>(
    type: T
  ): Result<INFTMetadataBuilder<NFTBuilderMap[T]['config'], NFTBuilderMap[T]['metadata']>, Error> {
    switch (type) {
      case NFTTypes.Music:
        return Result.ok(
          new MusicNFTMetadataBuilder() as INFTMetadataBuilder<
            NFTBuilderMap[T]['config'],
            NFTBuilderMap[T]['metadata']
          >
        );
      default:
        return Result.err(new Error(`No builder found for NFT type: ${type}`));
    }
  }
}

export class MusicNFTMetadataBuilder
  implements INFTMetadataBuilder<MusicNFTConfig, MusicNFTMetadata>
{
  buildMetadata(config: MusicNFTConfig): Result<MusicNFTMetadata, Error> {
    const validationResult = this.validateConfig(config);
    if (validationResult.isErr()) {
      return Result.err(validationResult.getErr()!);
    }

    const baseAttributes = [
      { trait_type: 'App', value: 'itheum.io/music' },
      { trait_type: 'Type', value: 'Music' },
      { trait_type: 'itheum_creator', value: config.itheumCreator },
      {
        trait_type: 'itheum_data_stream_url',
        value: config.itheumDataStreamUrl
      }
    ];

    const optionalAttributes = [
      config.itheumDrop && { trait_type: 'ItheumDrop', value: config.itheumDrop },
      config.rarity && { trait_type: 'Rarity', value: config.rarity },
      config.tokenCode && { trait_type: 'TokenCode', value: config.tokenCode }
    ].filter(Boolean); 

    try {
      const metadata: MusicNFTMetadata = {
        animation_url: config.animationUrl,
        attributes: [...baseAttributes, ...optionalAttributes,...(config.additionalTraits ?? [])],
        description: config.description,
        external_url: 'https://itheum.io/music',
        image: config.imageUrl,
        name: config.name,
        properties: {
          category: 'audio',
          files: [
            { type: 'image/gif', uri: config.imageUrl },
            { type: 'audio/mpeg', uri: config.previewMusicUrl }
          ]
        },
        symbol: config.tokenCode
      };

      return Result.ok(metadata);
    } catch (err) {
      return Result.err(new Error(`Failed to build metadata: ${err.message}`));
    }
  }

  private validateConfig(config: MusicNFTConfig): Result<void, Error> {
    const requiredFields: (keyof MusicNFTConfig)[] = [
      'animationUrl',
      'itheumCreator',
      'itheumDataStreamUrl',
      'description',
      'imageUrl',
      'name'
    ];

    const missing = requiredFields.filter((field) => !config[field]);
    if (missing.length) {
      return Result.err(new Error(`Missing required fields: ${missing.join(', ')}`));
    }

    return Result.ok();
  }
}

// Example usage:
// const config: MusicNFTConfig = {
//   animationUrl: "https://arweave.net/example-mp3",
//   itheumCreator: "Enh4wN39eKZ4xWAcKZCCVdxEnRCfVWkjaNT9aPDXS9nH",
//   itheumDataStreamUrl: "encoded-data-stream-url",
//   tokenCode: "MUSG2",
//   description: "Dark Hip Hop Instrumentals Common Album",
//   imageUrl: "https://arweave.net/example-gif",`
//   name: "MUSG2 - Cranium Beats",
//   additionalTraits: [
//     {
//       trait_type: "Artist",
//       value: "YFGP"
//     }
//   ],
//   rarity: "Rare"
// };

// Usage example:
// const builder = NFTMetadataBuilderFactory.getBuilder(NFTType.Music);
// const metadata = builder.buildMetadata(config);
