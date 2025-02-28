import {
  IMarshalDecryptParams,
  IMarshalDecryptResponse,
  IEncryptParams,
  IEncryptResponse,
  IMarshalManager
} from './types';
import { Result } from '../result';
import axios from 'axios';
import { aithraToolkitLogger } from './logger';

export class MarshalManager implements IMarshalManager {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async encrypt(params: IEncryptParams): Promise<Result<IEncryptResponse, Error>> {
    aithraToolkitLogger.debug('Entering encrypt');
    if (!params.dataNFTStreamUrl) {
      return Result.err(new Error('dataNFTStreamUrl is required for generation'));
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

      aithraToolkitLogger.debug('Exiting encrypt');
      return Result.ok(response.data);
    } catch (err) {
      return Result.err(
        new Error(`Encryption failed: ${err instanceof Error ? err.message : String(err)}`)
      );
    }
  }

  async decrypt(
    params: IMarshalDecryptParams
  ): Promise<Result<IMarshalDecryptResponse, Error>> {
    aithraToolkitLogger.debug('Entering decrypt');
    if (!params.encryptedMessage) {
      return Result.err(new Error('encryptedMessage is required for decryption'));
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
      aithraToolkitLogger.debug('Exiting decrypt');
      return Result.ok(response.data);
    } catch (err) {
      return Result.err(
        new Error(`Decryption failed: ${err instanceof Error ? err.message : String(err)}`)
      );
    }
  }
}
