import axios from 'axios';
import { MarshalManager } from '../core/marshalManager';
import {
  IEncryptParams,
  IEncryptResponse,
  IMarshalDecryptParams,
  IMarshalDecryptResponse
} from '../core/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MarshalManager', () => {
  const apiBaseUrl = 'https://api.example.com';
  let marshalManager: MarshalManager;

  beforeEach(() => {
    marshalManager = new MarshalManager(apiBaseUrl);
    jest.clearAllMocks();
  });

  describe('generate', () => {
    const validGenerateParams: IEncryptParams = {
      dataNFTStreamUrl: 'https://example.com/stream',
      dataCreatorERDAddress: 'erd1example',
      dataCreatorSOLAddress: 'sol1example'
    };

    const mockGenerateResponse: IEncryptResponse = {
      encryptedMessage: 'encrypted123',
      messageHash: 'hash123'
    };

    it('should successfully generate with valid parameters', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockGenerateResponse });

      const result = await marshalManager.encrypt(validGenerateParams);

      expect(result).toEqual(mockGenerateResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${apiBaseUrl}/generate_V2`,
        validGenerateParams,
        {
          headers: {
            'Content-Type': 'application/json',
            accept: '*/*'
          }
        }
      );
    });

    it('should throw error when dataNFTStreamUrl is missing', async () => {
      const invalidParams = {
        ...validGenerateParams,
        dataNFTStreamUrl: ''
      };

      await expect(() => marshalManager.encrypt(invalidParams)).rejects.toThrow(
        'dataNFTStreamUrl is required for generation'
      );
    });

    it('should throw API errors directly', async () => {
      const error = new Error('Network error');
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(() =>
        marshalManager.encrypt(validGenerateParams)
      ).rejects.toThrow(error);
    });
  });

  describe('decrypt', () => {
    const validDecryptParams: IMarshalDecryptParams = {
      encryptedMessage: 'encrypted123'
    };

    const mockDecryptResponse: IMarshalDecryptResponse = {
      decryptedData: 'test123',
      additionalField: 'value'
    };

    it('should successfully decrypt with valid parameters', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockDecryptResponse });

      const result = await marshalManager.decrypt(validDecryptParams);

      expect(result).toEqual(mockDecryptResponse);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${apiBaseUrl}/decrypt_v2`,
        validDecryptParams,
        {
          headers: {
            'Content-Type': 'application/json',
            accept: '*/*'
          }
        }
      );
    });

    it('should throw error when encryptedMessage is missing', async () => {
      const invalidParams = {
        ...validDecryptParams,
        encryptedMessage: ''
      };

      await expect(() => marshalManager.decrypt(invalidParams)).rejects.toThrow(
        'encryptedMessage is required for decryption'
      );
    });

    it('should throw API errors directly', async () => {
      const error = new Error('Network error');
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(() =>
        marshalManager.decrypt(validDecryptParams)
      ).rejects.toThrow(error);
    });
  });
});
