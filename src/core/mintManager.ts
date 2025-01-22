import axios from 'axios';
import { MintConfig, MintManagerParams, IMintManager } from './types';

export class MintManager implements IMintManager {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async mint(params: MintManagerParams): Promise<any> {
    if (!params.config || !params.address || !params.paymentHash) {
      throw new Error('Missing required parameters');
    }

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/mint`,
        params.config,
        {
          headers: {
            'Content-Type': 'application/json',
            address: params.address,
            'payment-hash': params.paymentHash
          }
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }
}
