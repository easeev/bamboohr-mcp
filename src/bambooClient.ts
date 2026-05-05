import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Config, loadConfig } from './config.js';
import { categorizeError } from './errors.js';

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

interface RequestOptions {
  skipCache?: boolean;
}

let clientInstance: AxiosInstance | null = null;
let configInstance: Config | null = null;
const cache = new Map<string, CacheEntry>();

function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeError(error: AxiosError): AxiosError {
  if (error.config) {
    const sanitizedConfig = { ...error.config };
    delete (sanitizedConfig as Record<string, unknown>).auth;
    if (sanitizedConfig.headers) {
      const headers = { ...sanitizedConfig.headers } as Record<string, unknown>;
      delete headers['Authorization'];
      delete headers['authorization'];
      sanitizedConfig.headers = headers as typeof sanitizedConfig.headers;
    }
    error.config = sanitizedConfig;
  }
  return error;
}

function createClient(): AxiosInstance {
  const config = getConfig();

  const instance = axios.create({
    baseURL: `https://api.bamboohr.com/api/gateway.php/${config.companyDomain}/v1`,
    auth: {
      username: config.apiToken,
      password: 'x',
    },
    headers: {
      Accept: 'application/json',
    },
    timeout: config.requestTimeoutMs,
  });

  // Debug request interceptor — never logs auth
  if (config.debug) {
    instance.interceptors.request.use((reqConfig: InternalAxiosRequestConfig) => {
      console.error(`[DEBUG] ${reqConfig.method?.toUpperCase()} ${reqConfig.url}`);
      return reqConfig;
    });
  }

  // Response error interceptor — sanitize before exposing
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      return Promise.reject(sanitizeError(error));
    }
  );

  return instance;
}

export function getClient(): AxiosInstance {
  if (!clientInstance) {
    clientInstance = createClient();
  }
  return clientInstance;
}

export function getCacheKey(method: string, url: string, params?: Record<string, unknown>): string {
  const paramStr = params ? JSON.stringify(params, Object.keys(params).sort()) : '';
  return `${method}:${url}:${paramStr}`;
}

export function clearCache(): void {
  cache.clear();
}

export async function bambooGet<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: RequestOptions
): Promise<T> {
  const config = getConfig();
  const client = getClient();

  // Check cache for GET requests
  if (!options?.skipCache) {
    const cacheKey = getCacheKey('GET', path, params);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client.get<T>(path, { params });

      // Store in cache
      const cacheKey = getCacheKey('GET', path, params);
      cache.set(cacheKey, {
        data: response.data,
        expiresAt: Date.now() + config.cacheTtlMs,
      });

      return response.data;
    } catch (error) {
      lastError = error;
      const categorized = categorizeError(error);

      if (!categorized.retryable || attempt === config.maxRetries) {
        throw error;
      }

      // Check for Retry-After header
      let delayMs: number;
      if (error instanceof AxiosError && error.response?.headers?.['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10);
        delayMs = isNaN(retryAfter) ? 1000 : retryAfter * 1000;
      } else {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 500;
        delayMs = baseDelay + jitter;
      }

      if (config.debug) {
        console.error(
          `[DEBUG] Retry ${attempt + 1}/${config.maxRetries} after ${delayMs}ms: ${categorized.message}`
        );
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function bambooPost<T>(
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const config = getConfig();
  const client = getClient();

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client.post<T>(path, data, { params });
      return response.data;
    } catch (error) {
      lastError = error;
      const categorized = categorizeError(error);

      if (!categorized.retryable || attempt === config.maxRetries) {
        throw error;
      }

      let delayMs: number;
      if (error instanceof AxiosError && error.response?.headers?.['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10);
        delayMs = isNaN(retryAfter) ? 1000 : retryAfter * 1000;
      } else {
        const baseDelay = Math.pow(2, attempt) * 1000;
        const jitter = Math.random() * 500;
        delayMs = baseDelay + jitter;
      }

      if (config.debug) {
        console.error(
          `[DEBUG] Retry ${attempt + 1}/${config.maxRetries} after ${delayMs}ms: ${categorized.message}`
        );
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function bambooPut<T>(
  path: string,
  data?: unknown
): Promise<T> {
  const client = getClient();
  const response = await client.put<T>(path, data);
  return response.data;
}

export interface FileDownloadResult {
  data: ArrayBuffer;
  contentType: string;
  filename: string;
}

export async function bambooDownloadFile(
  path: string,
  params?: Record<string, unknown>
): Promise<FileDownloadResult> {
  const client = getClient();
  const config = getConfig();

  // Validate and construct URL - prevent SSRF by only allowing BambooHR URLs
  let url: string;
  if (path.startsWith('http')) {
    // Parse URL to extract hostname and prevent bypass attacks like:
    // https://company.bamboohr.com@attacker.example/file
    const parsedUrl = new URL(path);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Require HTTPS to prevent credential exposure over HTTP
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid URL: only HTTPS URLs are allowed');
    }

    // Allow only BambooHR hostnames for the configured company domain
    const allowedHostnames = [
      `${config.companyDomain.toLowerCase()}.bamboohr.com`,
      'api.bamboohr.com',
    ];

    if (!allowedHostnames.includes(hostname)) {
      throw new Error(`Invalid URL: hostname ${hostname} is not allowed. Must be a BambooHR URL for domain ${config.companyDomain}`);
    }
    url = path;
  } else {
    // Relative path - only allow attachment/applicant_tracking endpoints
    // Prevent using this as a generic authenticated GET against any API path
    const allowedPathPrefixes = ['/applicant_tracking/', '/attachments/'];
    const isAllowedPath = allowedPathPrefixes.some(prefix => path.startsWith(prefix));
    if (!isAllowedPath) {
      throw new Error(`Invalid path: only attachment and applicant tracking paths are allowed`);
    }
    url = `${client.defaults.baseURL}${path}`;
  }

  const response = await client.get<ArrayBuffer>(url, {
    params,
    responseType: 'arraybuffer',
    headers: {
      Accept: '*/*',
    },
  });

  const contentType = String(response.headers['content-type'] || 'application/octet-stream');
  const contentDisposition = String(response.headers['content-disposition'] || '');

  // Extract filename from Content-Disposition header
  let filename = 'download';
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  if (match) {
    filename = match[1];
  }

  return {
    data: response.data,
    contentType,
    filename,
  };
}

// Reset for testing
export function _resetForTesting(): void {
  clientInstance = null;
  configInstance = null;
  cache.clear();
}
