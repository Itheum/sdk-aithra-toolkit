import axios from 'axios';
import { Result } from '../result';
import { MintConfig, MintManagerParams, IMintManager } from './types';

export class MintManager implements IMintManager {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async mint(params: MintManagerParams): Promise<Result<string[], Error>> {
    // Validate input parameters
    if (!params.config || !params.address || !params.paymentHash) {
      return Result.err(new Error('Missing required parameters'));
    }

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/bulk-mint`,
        params.config,
        {
          headers: {
            'Content-Type': 'application/json',
            address: params.address,
            'payment-hash': params.paymentHash
          }
        }
      );

      const { assetIds } = response.data;
      return Result.ok(assetIds as string[]);
    } catch (error) {
      return Result.err(
        new Error(`Minting failed: ${error instanceof Error ? error.message : String(error)}`)
      );
    }
  }
}
