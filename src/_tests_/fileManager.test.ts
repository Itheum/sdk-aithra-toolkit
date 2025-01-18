import axios from 'axios';
import { FileManager } from '../core/fileManager';
import FormData from 'form-data';
import { IFileManagerParams, ManifestType, UploadedFile } from '../core/types';

// Mock axios and FormData
jest.mock('axios');
jest.mock('form-data');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFormData = FormData as jest.MockedClass<typeof FormData>;

describe('FileManager', () => {
  let fileManager: FileManager;
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

    fileManager = new FileManager(mockApiBaseUrl);
  });

  describe('upload', () => {
    const mockFile = new File(['test content'], 'test.mp3', {
      type: 'audio/mpeg'
    });

    const mockUploadParams: IFileManagerParams = {
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

      const result = await fileManager.upload(mockUploadParams);

      // Verify axios post was called
      const expectedConfig = {
        headers: {
          'content-type': 'multipart/form-data',
          'payment-hash': mockUploadParams.paymentHash,
          address: mockUploadParams.address
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      };

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockApiBaseUrl}/paymentOnTheGo/upload_v2`,
        mockFormData,
        expectedConfig
      );

      expect(result).toEqual(mockUploadResponse.data);
    });

    it('should successfully upload multiple files', async () => {
      const mockFile2 = new File(['test content 2'], 'test2.mp3', {
        type: 'audio/mpeg'
      });
      const multipleFiles = [mockFile, mockFile2];
      const multipleFilesParams: IFileManagerParams = {
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

      const result = await fileManager.upload(multipleFilesParams);

      expect(mockFormData.append).toHaveBeenCalledTimes(4); // 2 files + category + origin
      expect(result).toEqual(mockMultipleResponse.data);
    });

    it('should throw error when no files are provided', async () => {
      const noFilesParams: IFileManagerParams = {
        ...mockUploadParams,
        files: [] as File[]
      };

      await expect(fileManager.upload(noFilesParams)).rejects.toThrow(
        'No files provided for upload'
      );
    });

    it('should handle upload failure', async () => {
      const mockError = new Error('Upload failed');
      mockedAxios.post.mockRejectedValueOnce(mockError);

      await expect(fileManager.upload(mockUploadParams)).rejects.toThrow(
        'Upload failed'
      );
    });

    it('should support different category types', async () => {
      const categories: Array<IFileManagerParams['category']> = [
        'files',
        'staticdata',
        ManifestType.MusicPlaylist
      ];

      for (const category of categories) {
        const params: IFileManagerParams = {
          ...mockUploadParams,
          category
        };

        mockedAxios.post.mockResolvedValueOnce(mockUploadResponse);
        await fileManager.upload(params);

        expect(mockFormData.append).toHaveBeenCalledWith('category', category);
      }
    });

    it('should correctly set form data fields', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockUploadResponse);

      await fileManager.upload(mockUploadParams);

      expect(mockFormData.append).toHaveBeenCalledWith('files', mockFile, {
        filename: mockFile.name,
        contentType: mockFile.type
      });
      expect(mockFormData.append).toHaveBeenCalledWith(
        'category',
        mockUploadParams.category
      );
      expect(mockFormData.append).toHaveBeenCalledWith('origin', 'agent-sdk');
    });

    it('should handle undefined files parameter', async () => {
      const undefinedFilesParams = {
        ...mockUploadParams,
        files: undefined
      };

      // Need to check for both conditions since the error might come from either check
      await expect(
        fileManager.upload(
          undefinedFilesParams as unknown as IFileManagerParams
        )
      ).rejects.toThrow(
        /No files provided for upload|Cannot read properties of undefined/
      );
    });

    it('should set infinite max lengths in axios config', async () => {
      mockedAxios.post.mockResolvedValueOnce(mockUploadResponse);

      await fileManager.upload(mockUploadParams);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        mockFormData,
        expect.objectContaining({
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        })
      );
    });
  });
});
