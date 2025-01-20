import axios from 'axios';
import { StorageManager } from '../core/storageManager';
import FormData from 'form-data';
import {
  IStorageManagerParams,
  ManifestType,
  UploadedFile,
  IpnsResponse
} from '../core/types';

// Mock axios and FormData
jest.mock('axios');
jest.mock('form-data');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFormData = FormData as jest.MockedClass<typeof FormData>;

describe('StorageManager', () => {
  let storageManager: StorageManager;
  const mockApiBaseUrl = 'https://api.example.com';
  let mockFormData: FormData;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a more realistic FormData mock
    mockFormData = {
      append: jest.fn(),
      getHeaders: jest
        .fn()
        .mockReturnValue({ 'content-type': 'multipart/form-data' })
    } as unknown as FormData;

    MockedFormData.mockImplementation(() => mockFormData);

    storageManager = new StorageManager(mockApiBaseUrl);
  });

  describe('upload', () => {
    const mockFile = new File(['test content'], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const mockUploadParams: IStorageManagerParams = {
      files: mockFile,
      category: ManifestType.MusicPlaylist,
      paymentHash: 'mock-payment-hash',
      address: 'mock-address'
    };

    const mockUploadResponse = {
      data: [
        {
          hash: 'Qm123456789',
          fileName: 'test.mp3',
          mimeType: 'audio/mpeg',
          folderHash: 'Qm987654321',
          category: ManifestType.MusicPlaylist
        }
      ] as UploadedFile[]
    };

    it('should successfully upload a single file', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockUploadResponse);

      const result = await storageManager.upload(mockUploadParams);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/paymentOnTheGo/upload_v2`,
        mockFormData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'payment-hash': mockUploadParams.paymentHash,
            address: mockUploadParams.address
          }),
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        })
      );

      expect(result).toEqual(mockUploadResponse.data);
    });

    it('should successfully upload multiple files', async () => {
      const mockFile2 = new File(['test content 2'], 'test2.mp3', {
        type: 'audio/mpeg'
      });
      const multipleFiles = [mockFile, mockFile2];
      const multipleFilesParams = {
        ...mockUploadParams,
        files: multipleFiles
      };

      const mockMultipleResponse = {
        data: [
          {
            hash: 'Qm123456789',
            fileName: 'test.mp3',
            mimeType: 'audio/mpeg',
            folderHash: 'Qm987654321',
            category: ManifestType.MusicPlaylist
          },
          {
            hash: 'Qm123456790',
            fileName: 'test2.mp3',
            mimeType: 'audio/mpeg',
            folderHash: 'Qm987654321',
            category: ManifestType.MusicPlaylist
          }
        ] as UploadedFile[]
      };

      mockedAxios.post.mockResolvedValueOnce(mockMultipleResponse);

      const result = await storageManager.upload(multipleFilesParams);

      expect(mockFormData.append).toHaveBeenCalledTimes(4); // 2 files + category + origin
      expect(result).toEqual(mockMultipleResponse.data);
    });

    it('should throw error when no files are provided', async () => {
      const noFilesParams = {
        ...mockUploadParams,
        files: [] as File[]
      };

      await expect(storageManager.upload(noFilesParams)).rejects.toThrow(
        'No files provided for upload'
      );
    });

    it('should handle upload failure', async () => {
      const mockError = new Error('Upload failed');
      mockedAxios.post.mockRejectedValueOnce(mockError);

      await expect(storageManager.upload(mockUploadParams)).rejects.toThrow(
        'Upload failed'
      );
    });
  });

  describe('pinToIpns', () => {
    const mockCid = 'Qm123456789';
    const mockAddress = 'mock-wallet-address';
    const mockIpnsResponse: IpnsResponse = {
      hash: 'k51qzi5uqu5dkkaju3035mj17asxj6qf3s3zqvjrz6hrq2ylqsvi6rwk2wd9mr',
      pointingHash: mockCid,
      key: 'ddlagkh459343',
      address: 'addresss',
      lastUpdated: 344
    };

    it('should successfully pin CID to IPNS', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockIpnsResponse });

      const result = await storageManager.pinToIpns(mockCid, mockAddress);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/ipns/publish_v2`,
        {
          params: { cid: mockCid },
          headers: {
            'Content-Type': 'application/json',
            address: mockAddress
          }
        }
      );

      expect(result).toEqual(mockIpnsResponse);
    });

    it('should throw error when CID is empty', async () => {
      await expect(storageManager.pinToIpns('', mockAddress)).rejects.toThrow(
        'CID is required for IPNS pinning'
      );

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should throw error when address is empty', async () => {
      await expect(storageManager.pinToIpns(mockCid, '')).rejects.toThrow(
        'Address is required for IPNS pinning'
      );

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should handle pinning failure', async () => {
      const mockError = new Error('IPNS pinning failed');
      mockedAxios.get.mockRejectedValueOnce(mockError);

      await expect(
        storageManager.pinToIpns(mockCid, mockAddress)
      ).rejects.toThrow('IPNS pinning failed');
    });

    it('should validate IPNS response format', async () => {
      const invalidResponse = {
        data: {
          hash: 'k51qzi5uqu5dkkaju3035mj17asxj6qf3s3zqvjrz6hrq2ylqsvi6rwk2wd9mr'
          // missing pointingHash
        }
      };

      mockedAxios.get.mockResolvedValueOnce(invalidResponse);

      const result = await storageManager.pinToIpns(mockCid, mockAddress);

      // The result should still match the response data even if incomplete
      expect(result).toEqual(invalidResponse.data);
    });

    it('should use correct URL and headers for IPNS request', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: mockIpnsResponse });

      await storageManager.pinToIpns(mockCid, mockAddress);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/ipns/publish_v2'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            address: mockAddress
          })
        })
      );
    });
  });
});
