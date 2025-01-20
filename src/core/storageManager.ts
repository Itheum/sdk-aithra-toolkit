import axios from 'axios';
import FormData from 'form-data';
import {
  IStorageManager,
  IStorageManagerParams,
  IpnsResponse,
  UploadedFile
} from './types';

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
    const files = Array.isArray(params.files) ? params.files : [params.files];

    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    const formData = new FormData();

    for (const file of files) {
      formData.append('files', file, {
        filename: file.name,
        contentType: file.type
      });
    }

    formData.append('category', params.category);
    formData.append('origin', 'agent-sdk');

    const response = await axios.post(
      `${this.apiBaseUrl}/paymentOnTheGo/upload_v2`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'payment-hash': params.paymentHash,
          address: params.address
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
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
  }
}
