// Set required env vars for tests before any module loads
process.env.BAMBOO_API_TOKEN = 'test-api-token';
process.env.BAMBOO_COMPANY_DOMAIN = 'testcompany';
process.env.BAMBOO_MAX_RETRIES = '0'; // no retries in tests
process.env.BAMBOO_CACHE_TTL_MS = '0'; // no caching in tests
