import {
  INFTMetadataBuilder,
  MusicNFTConfig,
  MusicNFTMetadata,
  NFTType,
  NFTTypes
} from './types';

export class NFTMetadataBuilderFactory {
  static getBuilder(
    type: typeof NFTTypes.Music
  ): INFTMetadataBuilder<typeof NFTTypes.Music>;
  static getBuilder<T extends NFTType>(type: T): INFTMetadataBuilder<T> {
    switch (type) {
      case NFTTypes.Music:
        return new MusicNFTMetadataBuilder() as unknown as INFTMetadataBuilder<T>;
      default:
        throw new Error(`No builder found for NFT type: ${type}`);
    }
  }
}

export class MusicNFTMetadataBuilder
  implements INFTMetadataBuilder<typeof NFTTypes.Music>
{
  buildMetadata(config: MusicNFTConfig): MusicNFTMetadata {
    this.validateConfig(config);

    const baseAttributes = [
      { trait_type: 'App', value: 'itheum.io/music' },
      { trait_type: 'ItheumDrop', value: config.itheumDrop },
      { trait_type: 'Type', value: 'Music' },
      { trait_type: 'itheum_creator', value: config.itheumCreator },
      {
        trait_type: 'itheum_data_stream_url',
        value: config.itheumDataStreamUrl
      },
      { trait_type: 'Rarity', value: config.rarity || 'Common' },
      { trait_type: 'TokenCode', value: config.tokenCode }
    ];

    return {
      animation_url: config.animationUrl,
      attributes: [...baseAttributes, ...(config.additionalTraits ?? [])],
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
  }

  private validateConfig(config: MusicNFTConfig): void {
    const requiredFields: (keyof MusicNFTConfig)[] = [
      'animationUrl',
      'itheumCreator',
      'itheumDataStreamUrl',
      'tokenCode',
      'description',
      'itheumDrop',
      'imageUrl',
      'name'
    ];

    const missing = requiredFields.filter((field) => !config[field]);
    if (missing.length) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
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
