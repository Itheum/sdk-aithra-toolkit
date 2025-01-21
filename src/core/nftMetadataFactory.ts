import {
  BaseNFTMetadata,
  INFTMetadataBuilder,
  MusicNFTConfig,
  NFTAttribute,
  NFTType
} from './types';

export class NFTMetadataBuilderFactory {
  static getBuilder(type: NFTType): INFTMetadataBuilder {
    switch (type) {
      case NFTType.Music:
        return new MusicNFTMetadataBuilder();
      default:
        throw new Error(`No builder found for NFT type: ${type}`);
    }
  }
}

export class MusicNFTMetadataBuilder implements INFTMetadataBuilder {
  buildMetadata(config: MusicNFTConfig): BaseNFTMetadata {
    this.validateConfig(config);

    const baseAttributes: NFTAttribute[] = [
      {
        trait_type: 'App',
        value: 'itheum.io/music'
      },
      {
        trait_type: 'ItheumDrop',
        value: config.itheumDrop || '20'
      },
      {
        trait_type: 'Type',
        value: 'Music'
      },
      {
        trait_type: 'itheum_creator',
        value: config.itheumCreator
      },
      {
        trait_type: 'itheum_data_stream_url',
        value: config.itheumDataStreamUrl
      },
      {
        trait_type: 'Rarity',
        value: config.rarity || 'Common'
      },
      {
        trait_type: 'TokenCode',
        value: config.tokenCode
      }
    ];

    const attributes = [...baseAttributes, ...(config.additionalTraits || [])];

    return {
      animation_url: config.animationUrl,
      attributes,
      description: config.description,
      external_url: 'https://itheum.io/music',
      image: config.imageUrl,
      name: config.name,
      properties: {
        category: 'audio',
        files: [
          {
            type: 'image/gif',
            uri: config.imageUrl
          },
          {
            type: 'audio/mpeg',
            uri: config.animationUrl
          }
        ]
      },
      symbol: ''
    };
  }

  private validateConfig(config: MusicNFTConfig): void {
    const requiredFields: (keyof MusicNFTConfig)[] = [
      'animationUrl',
      'itheumCreator',
      'itheumDataStreamUrl',
      'tokenCode',
      'description',
      'imageUrl',
      'name'
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
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
