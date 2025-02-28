import axios from 'axios';
import FormData from 'form-data';
import {
  IStorageManager,
  IStorageManagerParams,
  IpnsResponse,
  UploadedFile
} from './types';
import { Result } from '../result';
import fs from 'fs';
import { aithraToolkitLogger } from './logger';

export class StorageManager implements IStorageManager {
  private readonly apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Upload files to the system
   * @param params Upload parameters including files, manifest type, payment hash, and address
   * @returns Promise of uploaded files
   */
  async upload(params: IStorageManagerParams): Promise<Result<UploadedFile[], Error>> {
    aithraToolkitLogger.debug('Entering upload');
    try {
      // 1. Normalize and validate files
      const files = Array.isArray(params.files) ? params.files : [params.files];
      if (!files || files.length === 0) {
        return Result.err(new Error('No files provided for upload'));
      }

      // 2. Create FormData for upload
      const formData = new FormData();

      // 3. Process files
      for (const file of files) {
        try {
          const buffer = await file.arrayBuffer();
          formData.append('files', Buffer.from(buffer), {
            filename: file.name,
            contentType: file.type
          });
        } catch (err) {
          return Result.err(new Error(`Failed to process file ${file.name}: ${err.message}`));
        }
      }

      // 4. Add metadata
      formData.append('category', params.category);
      formData.append('origin', 'agent-sdk');

      // 5. Send upload request
      const response = await axios.post(
        `${this.apiBaseUrl}/paymentOnTheGo/upload_v2`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'payment-hash': params.paymentHash,
            'address': params.address
          }
        }
      );
      aithraToolkitLogger.debug('Exiting upload');
      return Result.ok(response.data);
    } catch (err) {
      return Result.err(new Error(`Upload failed: ${err.message}`));
    }
  }

  async pinToIpns(cid: string, address: string): Promise<Result<IpnsResponse, Error>> {
    aithraToolkitLogger.debug('Entering pinToIpns');
    if (!cid) {
      return Result.err(new Error('CID is required for IPNS pinning'));
    }

    if (!address) {
      return Result.err(new Error('Address is required for IPNS pinning'));
    }

    try {
      const response = await axios.get<IpnsResponse>(
        `${this.apiBaseUrl}/ipns/publish_v2`,
        {
          params: { cid },
          headers: {
            'Content-Type': 'application/json',
            address: address
          }
        }
      );
      aithraToolkitLogger.debug('Exiting pinToIpns');
      return Result.ok(response.data);
    } catch (err) {
      return Result.err(new Error(`IPNS pinning failed: ${err.message}`));
    }
  }
}
