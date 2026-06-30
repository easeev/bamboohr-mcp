import axios, { AxiosError, AxiosHeaders } from 'axios';
import { bambooGet, bambooPost, bambooPut, bambooWebGet, clearCache, getCacheKey, resolveBambooFileUrl, _resetForTesting } from '../bambooClient';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeAxiosError(status: number): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError(
    'test error',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    { status, statusText: 'Error', headers: {}, config: { headers }, data: '' }
  );
}

describe('bambooClient', () => {
  let mockInstance: {
    get: jest.Mock;
    post: jest.Mock;
    put: jest.Mock;
    interceptors: { request: { use: jest.Mock }; response: { use: jest.Mock } };
  };

  beforeEach(() => {
    _resetForTesting();
    process.env.BAMBOO_API_TOKEN = 'test-token';
    process.env.BAMBOO_COMPANY_DOMAIN = 'testco';
    process.env.BAMBOO_MAX_RETRIES = '0';
    process.env.BAMBOO_CACHE_TTL_MS = '0';
    delete process.env.DEBUG;

    mockInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockInstance as any);
  });

  describe('client creation', () => {
    it('creates axios instance with correct config', async () => {
      mockInstance.get.mockResolvedValueOnce({ data: {} });
      await bambooGet('/test');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.bamboohr.com/api/gateway.php/testco/v1',
          auth: { username: 'test-token', password: 'x' },
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('reuses the same client instance', async () => {
      mockInstance.get.mockResolvedValue({ data: {} });
      await bambooGet('/test1');
      await bambooGet('/test2');
      expect(mockedAxios.create).toHaveBeenCalledTimes(1);
    });

    it('registers debug interceptor when DEBUG=true', async () => {
      _resetForTesting();
      process.env.DEBUG = 'true';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get.mockResolvedValueOnce({ data: {} });

      await bambooGet('/test');
      expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('registers response error interceptor', async () => {
      mockInstance.get.mockResolvedValueOnce({ data: {} });
      await bambooGet('/test');
      expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('bambooGet', () => {
    it('makes GET request and returns data', async () => {
      mockInstance.get.mockResolvedValueOnce({ data: { id: '1', name: 'Test' } });
      const data = await bambooGet('/employees/1');
      expect(data).toEqual({ id: '1', name: 'Test' });
      expect(mockInstance.get).toHaveBeenCalledWith('/employees/1', { params: undefined });
    });

    it('passes params to GET request', async () => {
      mockInstance.get.mockResolvedValueOnce({ data: [] });
      await bambooGet('/employees/directory', { status: 'active' });
      expect(mockInstance.get).toHaveBeenCalledWith('/employees/directory', {
        params: { status: 'active' },
      });
    });

    it('caches GET responses when TTL > 0', async () => {
      _resetForTesting();
      process.env.BAMBOO_CACHE_TTL_MS = '60000';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get.mockResolvedValueOnce({ data: { cached: true } });

      const first = await bambooGet('/test');
      const second = await bambooGet('/test');

      expect(first).toEqual({ cached: true });
      expect(second).toEqual({ cached: true });
      expect(mockInstance.get).toHaveBeenCalledTimes(1);
    });

    it('skips cache when skipCache option is set', async () => {
      _resetForTesting();
      process.env.BAMBOO_CACHE_TTL_MS = '60000';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get.mockResolvedValue({ data: { fresh: true } });

      await bambooGet('/test');
      await bambooGet('/test', undefined, { skipCache: true });

      expect(mockInstance.get).toHaveBeenCalledTimes(2);
    });

    it('throws on non-retryable error', async () => {
      const error = new Error('Not found');
      mockInstance.get.mockRejectedValueOnce(error);
      await expect(bambooGet('/missing')).rejects.toThrow('Not found');
    });

    it('retries on retryable error', async () => {
      _resetForTesting();
      process.env.BAMBOO_MAX_RETRIES = '1';
      process.env.BAMBOO_CACHE_TTL_MS = '0';
      mockedAxios.create.mockReturnValue(mockInstance as any);

      const headers = new AxiosHeaders();
      const retryableError = new AxiosError(
        'Server error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500, statusText: 'Error', headers: {}, config: { headers }, data: '' }
      );

      mockInstance.get
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ data: { success: true } });

      const result = await bambooGet('/test');
      expect(result).toEqual({ success: true });
      expect(mockInstance.get).toHaveBeenCalledTimes(2);
    });

    it('respects Retry-After header', async () => {
      _resetForTesting();
      process.env.BAMBOO_MAX_RETRIES = '1';
      process.env.BAMBOO_CACHE_TTL_MS = '0';
      mockedAxios.create.mockReturnValue(mockInstance as any);

      const headers = new AxiosHeaders();
      const rateLimitError = new AxiosError(
        'Rate limited',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'retry-after': '1' },
          config: { headers },
          data: '',
        }
      );

      mockInstance.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { ok: true } });

      const result = await bambooGet('/test');
      expect(result).toEqual({ ok: true });
    });

    it('exhausts retries and throws', async () => {
      _resetForTesting();
      process.env.BAMBOO_MAX_RETRIES = '1';
      process.env.BAMBOO_CACHE_TTL_MS = '0';
      mockedAxios.create.mockReturnValue(mockInstance as any);

      // Use a plain Error (non-retryable), so it throws immediately
      const error = new Error('Permanent failure');

      mockInstance.get.mockRejectedValue(error);
      await expect(bambooGet('/test')).rejects.toThrow('Permanent failure');
      expect(mockInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('bambooWebGet', () => {
    it('uses BambooHR company web host with API token auth', async () => {
      mockInstance.get.mockResolvedValueOnce({ data: { result: [] } });

      const data = await bambooWebGet('/hiring/api/applications/41271/notes');

      expect(data).toEqual({ result: [] });
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://testco.bamboohr.com',
          auth: { username: 'test-token', password: 'x' },
          headers: { Accept: 'application/json' },
        })
      );
      expect(mockInstance.get).toHaveBeenCalledWith('/hiring/api/applications/41271/notes', { params: undefined });
    });

    it('caches web GET responses when TTL > 0', async () => {
      _resetForTesting();
      process.env.BAMBOO_CACHE_TTL_MS = '60000';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get.mockResolvedValueOnce({ data: { cached: true } });

      const first = await bambooWebGet('/hiring/api/settings');
      const second = await bambooWebGet('/hiring/api/settings');

      expect(first).toEqual({ cached: true });
      expect(second).toEqual({ cached: true });
      expect(mockInstance.get).toHaveBeenCalledTimes(1);
    });

    it('skips web GET cache when skipCache option is set', async () => {
      _resetForTesting();
      process.env.BAMBOO_CACHE_TTL_MS = '60000';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get.mockResolvedValue({ data: { fresh: true } });

      await bambooWebGet('/hiring/api/applications/41271/notes');
      await bambooWebGet('/hiring/api/applications/41271/notes', undefined, { skipCache: true });

      expect(mockInstance.get).toHaveBeenCalledTimes(2);
    });

    it('retries web GET server errors', async () => {
      _resetForTesting();
      process.env.BAMBOO_MAX_RETRIES = '1';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get
        .mockRejectedValueOnce(makeAxiosError(500))
        .mockResolvedValueOnce({ data: { ok: true } });

      const data = await bambooWebGet('/hiring/api/settings');

      expect(data).toEqual({ ok: true });
      expect(mockInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('bambooPost', () => {
    it('makes POST request and returns data', async () => {
      mockInstance.post.mockResolvedValueOnce({ data: { success: true } });
      const data = await bambooPost('/employees/1', { name: 'New' });
      expect(data).toEqual({ success: true });
      expect(mockInstance.post).toHaveBeenCalledWith('/employees/1', { name: 'New' }, { params: undefined });
    });

    it('retries on server error', async () => {
      _resetForTesting();
      process.env.BAMBOO_MAX_RETRIES = '1';
      process.env.BAMBOO_CACHE_TTL_MS = '0';
      mockedAxios.create.mockReturnValue(mockInstance as any);

      const headers = new AxiosHeaders();
      const error = new AxiosError(
        'Server error',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        { status: 500, statusText: 'Error', headers: {}, config: { headers }, data: '' }
      );

      mockInstance.post
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: { ok: true } });

      const result = await bambooPost('/test', {});
      expect(result).toEqual({ ok: true });
      expect(mockInstance.post).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-retryable error', async () => {
      const error = new Error('Bad request');
      mockInstance.post.mockRejectedValueOnce(error);
      await expect(bambooPost('/test', {})).rejects.toThrow('Bad request');
      expect(mockInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('bambooPut', () => {
    it('makes PUT request and returns data', async () => {
      mockInstance.put.mockResolvedValueOnce({ data: { updated: true } });
      const data = await bambooPut('/employees/1/time_off/request', { start: '2026-03-01' });
      expect(data).toEqual({ updated: true });
    });
  });

  describe('getCacheKey', () => {
    it('generates consistent keys', () => {
      const key1 = getCacheKey('GET', '/test', { a: 1, b: 2 });
      const key2 = getCacheKey('GET', '/test', { a: 1, b: 2 });
      expect(key1).toBe(key2);
    });

    it('generates different keys for different params', () => {
      const key1 = getCacheKey('GET', '/test', { a: 1 });
      const key2 = getCacheKey('GET', '/test', { b: 2 });
      expect(key1).not.toBe(key2);
    });

    it('handles no params', () => {
      const key = getCacheKey('GET', '/test');
      expect(key).toBe('GET:/test:');
    });
  });

  describe('resolveBambooFileUrl', () => {
    it('allows configured BambooHR attachment URLs', () => {
      const url = resolveBambooFileUrl('https://testco.bamboohr.com/attachments/123');
      expect(url).toBe('https://testco.bamboohr.com/attachments/123');
    });

    it('allows configured BambooHR API file URLs', () => {
      const url = resolveBambooFileUrl('https://api.bamboohr.com/api/gateway.php/testco/v1/files/456');
      expect(url).toBe('https://api.bamboohr.com/api/gateway.php/testco/v1/files/456');
    });

    it('allows relative file URLs for recruiting attachments', () => {
      const url = resolveBambooFileUrl('/files/456');
      expect(url).toBe('https://api.bamboohr.com/api/gateway.php/testco/v1/files/456');
    });

    it('rejects non-BambooHR URLs', () => {
      expect(() => resolveBambooFileUrl('https://example.com/attachments/123')).toThrow('hostname example.com is not allowed');
    });

    it('rejects HTTP URLs', () => {
      expect(() => resolveBambooFileUrl('http://testco.bamboohr.com/attachments/123')).toThrow('only HTTPS URLs are allowed');
    });

    it('rejects disallowed relative paths', () => {
      expect(() => resolveBambooFileUrl('/employees/directory')).toThrow('only attachment, file, and applicant tracking paths are allowed');
    });

    it('rejects disallowed absolute company paths', () => {
      expect(() => resolveBambooFileUrl('https://testco.bamboohr.com/employees/directory')).toThrow('only attachment, file, and applicant tracking paths are allowed');
    });

    it('rejects disallowed absolute API paths', () => {
      expect(() => resolveBambooFileUrl('https://api.bamboohr.com/api/gateway.php/testco/v1/employees/directory')).toThrow('only attachment, file, and applicant tracking paths are allowed');
    });

    it('rejects absolute API paths for another BambooHR company', () => {
      expect(() => resolveBambooFileUrl('https://api.bamboohr.com/api/gateway.php/otherco/v1/files/456')).toThrow('API path is not allowed for this BambooHR company');
    });

    it('rejects literal relative path traversal', () => {
      expect(() => resolveBambooFileUrl('/applicant_tracking/../../employees/directory')).toThrow('path traversal not allowed');
    });

    it('rejects URL-encoded relative path traversal', () => {
      expect(() => resolveBambooFileUrl('/applicant_tracking/%2e%2e/employees/directory')).toThrow('path traversal not allowed');
      expect(() => resolveBambooFileUrl('/applicant_tracking/.%2e/employees/directory')).toThrow('path traversal not allowed');
      expect(() => resolveBambooFileUrl('/applicant_tracking/%2e./employees/directory')).toThrow('path traversal not allowed');
    });

    it('rejects double-encoded relative path traversal', () => {
      expect(() => resolveBambooFileUrl('/files/%252e%252e/employees/directory')).toThrow('path traversal not allowed');
      expect(() => resolveBambooFileUrl('/applicant_tracking/%252e%252e/employees/directory')).toThrow('path traversal not allowed');
    });

    it('rejects repeatedly encoded relative path traversal', () => {
      expect(() => resolveBambooFileUrl('/files/%25252e%25252e/employees/directory')).toThrow('path traversal not allowed');
      expect(() => resolveBambooFileUrl('/applicant_tracking/%2525252e%2525252e/employees/directory')).toThrow('path traversal not allowed');
    });

    it('rejects encoded path separators in relative paths', () => {
      expect(() => resolveBambooFileUrl('/applicant_tracking%2f..%2femployees/directory')).toThrow('encoded path separators not allowed');
      expect(() => resolveBambooFileUrl('/applicant_tracking%252f..%252femployees/directory')).toThrow('path traversal not allowed');
    });

    it('rejects malformed URL encoding in relative paths', () => {
      expect(() => resolveBambooFileUrl('/files/%')).toThrow('malformed URL encoding');
    });
  });

  describe('clearCache', () => {
    it('clears all cached entries', async () => {
      _resetForTesting();
      process.env.BAMBOO_CACHE_TTL_MS = '60000';
      mockedAxios.create.mockReturnValue(mockInstance as any);
      mockInstance.get.mockResolvedValue({ data: 'cached' });

      await bambooGet('/test');
      clearCache();
      await bambooGet('/test');

      expect(mockInstance.get).toHaveBeenCalledTimes(2);
    });
  });
});
