import { loadConfig } from '../config';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BAMBOO_API_TOKEN = 'test-token';
    process.env.BAMBOO_COMPANY_DOMAIN = 'testco';
    // Remove setup.ts overrides so we test real defaults
    delete process.env.BAMBOO_MAX_RETRIES;
    delete process.env.BAMBOO_CACHE_TTL_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads valid config from env vars', () => {
    const config = loadConfig();
    expect(config.apiToken).toBe('test-token');
    expect(config.companyDomain).toBe('testco');
    expect(config.debug).toBe(false);
    expect(config.cacheTtlMs).toBe(300000);
    expect(config.maxRetries).toBe(3);
    expect(config.requestTimeoutMs).toBe(30000);
    expect(config.updateAllowedFields).toBeNull();
  });

  it('throws when BAMBOO_API_TOKEN is missing', () => {
    delete process.env.BAMBOO_API_TOKEN;
    expect(() => loadConfig()).toThrow('BAMBOO_API_TOKEN');
  });

  it('throws when BAMBOO_COMPANY_DOMAIN is missing', () => {
    delete process.env.BAMBOO_COMPANY_DOMAIN;
    expect(() => loadConfig()).toThrow('BAMBOO_COMPANY_DOMAIN');
  });

  it('throws for invalid subdomain starting with hyphen', () => {
    process.env.BAMBOO_COMPANY_DOMAIN = '-invalid';
    expect(() => loadConfig()).toThrow('Invalid BAMBOO_COMPANY_DOMAIN');
  });

  it('throws for invalid subdomain ending with hyphen', () => {
    process.env.BAMBOO_COMPANY_DOMAIN = 'invalid-';
    expect(() => loadConfig()).toThrow('Invalid BAMBOO_COMPANY_DOMAIN');
  });

  it('throws for subdomain with special characters', () => {
    process.env.BAMBOO_COMPANY_DOMAIN = 'my_company!';
    expect(() => loadConfig()).toThrow('Invalid BAMBOO_COMPANY_DOMAIN');
  });

  it('accepts valid subdomain with hyphens', () => {
    process.env.BAMBOO_COMPANY_DOMAIN = 'my-company';
    const config = loadConfig();
    expect(config.companyDomain).toBe('my-company');
  });

  it('accepts single character subdomain', () => {
    process.env.BAMBOO_COMPANY_DOMAIN = 'a';
    const config = loadConfig();
    expect(config.companyDomain).toBe('a');
  });

  it('parses debug flag', () => {
    process.env.DEBUG = 'true';
    const config = loadConfig();
    expect(config.debug).toBe(true);
  });

  it('parses custom cache TTL', () => {
    process.env.BAMBOO_CACHE_TTL_MS = '60000';
    const config = loadConfig();
    expect(config.cacheTtlMs).toBe(60000);
  });

  it('parses update allowed fields', () => {
    process.env.BAMBOO_UPDATE_ALLOWED_FIELDS = 'firstName, lastName, mobilePhone';
    const config = loadConfig();
    expect(config.updateAllowedFields).toEqual(['firstName', 'lastName', 'mobilePhone']);
  });

  it('returns null for empty allowed fields', () => {
    process.env.BAMBOO_UPDATE_ALLOWED_FIELDS = '';
    const config = loadConfig();
    expect(config.updateAllowedFields).toBeNull();
  });
});
