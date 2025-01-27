import axios from 'axios';
import { MintConfig, MintManagerParams, IMintManager } from './types';

export class MintManager implements IMintManager {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async mint(params: MintManagerParams): Promise<string[]> {
    if (!params.config || !params.address || !params.paymentHash) {
      throw new Error('Missing required parameters');
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

      const { signatures } = response.data;

      return signatures as string[];
    } catch (error) {
      throw error;
    }
  }
}
