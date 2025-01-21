import {
  IMarshalDecryptParams,
  IMarshalDecryptResponse,
  IEncryptParams,
  IEncryptResponse,
  IMarshalManager
} from './types';
import axios from 'axios';

export class MarshalManager implements IMarshalManager {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async encrypt(params: IEncryptParams): Promise<IEncryptResponse> {
    if (!params.dataNFTStreamUrl) {
      throw new Error('dataNFTStreamUrl is required for generation');
    }

    try {
      const response = await axios.post<IEncryptResponse>(
        `${this.apiBaseUrl}/generate_V2`,
        params,
        {
          headers: {
            'Content-Type': 'application/json',
            accept: '*/*'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async decrypt(
    params: IMarshalDecryptParams
  ): Promise<IMarshalDecryptResponse> {
    if (!params.encryptedMessage) {
      throw new Error('encryptedMessage is required for decryption');
    }

    try {
      const response = await axios.post<IMarshalDecryptResponse>(
        `${this.apiBaseUrl}/decrypt_v2`,
        params,
        {
          headers: {
            'Content-Type': 'application/json',
            accept: '*/*'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }
}
