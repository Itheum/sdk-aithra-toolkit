import axios from 'axios';
import { MintManager } from '../core/mintManager';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MintManager', () => {
  const apiBaseUrl = 'http://api.example.com';
  const mockConfig = {
    mintForSolAddr: 'test-address',
    tokenName: 'TEST',
    metadataOnIpfsUrl: 'test-url',
    sellerFeeBasisPoints: 500,
    creators: [{ address: 'creator1', share: 100 }],
    quantity: 1
  };
  const mockParams = {
    config: mockConfig,
    address: 'test-wallet',
    paymentHash: 'test-hash'
  };

  let mintManager: MintManager;

  beforeEach(() => {
    mintManager = new MintManager(apiBaseUrl);
    jest.clearAllMocks();
  });

  it('should create an instance with apiBaseUrl', () => {
    expect(mintManager).toBeInstanceOf(MintManager);
  });

  it('should successfully mint with valid parameters', async () => {
    const mockResponse = { success: true };
    mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

    const result = await mintManager.mint(mockParams);

    expect(result).toEqual(mockResponse);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${apiBaseUrl}/mint`,
      mockParams.config,
      {
        headers: {
          'Content-Type': 'application/json',
          address: mockParams.address,
          'payment-hash': mockParams.paymentHash
        }
      }
    );
  });

  it('should throw error when required parameters are missing', async () => {
    const invalidParams = {
      config: mockConfig,
      address: '',
      paymentHash: mockParams.paymentHash
    };
    await expect(mintManager.mint(invalidParams)).rejects.toThrow(
      'Missing required parameters'
    );
  });

  it('should handle API errors', async () => {
    const mockError = new Error('API Error');
    mockedAxios.post.mockRejectedValueOnce(mockError);

    await expect(mintManager.mint(mockParams)).rejects.toThrow('API Error');
  });
});
