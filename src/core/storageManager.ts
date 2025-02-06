import axios from 'axios';
import FormData from 'form-data';
import {
  IStorageManager,
  IStorageManagerParams,
  IpnsResponse,
  UploadedFile
} from './types';
import fs from 'fs';

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
  async upload(params: IStorageManagerParams): Promise<UploadedFile[]> {
    // 1. Normalize files to an array
    const files = Array.isArray(params.files) ? params.files : [params.files];

    // 2. Validate files exist
    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    // 3. Create FormData for upload
    const formData = new FormData();

    // 4. Process each file based on its type
    for (const file of files) {
      // Detect file type and prepare stream/metadata
      // Append file to FormData
      formData.append('files', Buffer.from(await file.arrayBuffer()), {
        filename: file.name,
        contentType: file.type
      });
    }

    // 5. Add additional metadata
    formData.append('category', params.category);
    formData.append('origin', 'agent-sdk');

    // 6. Send upload request
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

    return response.data;
  }

  async pinToIpns(cid: string, address: string): Promise<IpnsResponse> {
    if (!cid) {
      throw new Error('CID is required for IPNS pinning');
    }

    if (!address) {
      throw new Error('Address is required for IPNS pinning');
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

      return response.data;
    } catch (error) {
      throw error;
    }
  }
}
