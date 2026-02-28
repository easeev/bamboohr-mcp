const SUBDOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

export interface Config {
  apiToken: string;
  companyDomain: string;
  debug: boolean;
  cacheTtlMs: number;
  maxRetries: number;
  requestTimeoutMs: number;
  updateAllowedFields: string[] | null;
}

export function loadConfig(): Config {
  const apiToken = process.env.BAMBOO_API_TOKEN;
  if (!apiToken) {
    throw new Error('BAMBOO_API_TOKEN environment variable is required');
  }

  const companyDomain = process.env.BAMBOO_COMPANY_DOMAIN;
  if (!companyDomain) {
    throw new Error('BAMBOO_COMPANY_DOMAIN environment variable is required');
  }

  if (!SUBDOMAIN_REGEX.test(companyDomain)) {
    throw new Error(
      `Invalid BAMBOO_COMPANY_DOMAIN "${companyDomain}": must contain only alphanumeric characters and hyphens, and cannot start/end with a hyphen`
    );
  }

  const debug = process.env.DEBUG === 'true';
  const cacheTtlMs = parseInt(process.env.BAMBOO_CACHE_TTL_MS || '300000', 10);
  const maxRetries = parseInt(process.env.BAMBOO_MAX_RETRIES || '3', 10);
  const requestTimeoutMs = parseInt(process.env.BAMBOO_REQUEST_TIMEOUT_MS || '30000', 10);

  const allowedFieldsEnv = process.env.BAMBOO_UPDATE_ALLOWED_FIELDS;
  const updateAllowedFields = allowedFieldsEnv
    ? allowedFieldsEnv.split(',').map((f) => f.trim()).filter(Boolean)
    : null;

  return {
    apiToken,
    companyDomain,
    debug,
    cacheTtlMs,
    maxRetries,
    requestTimeoutMs,
    updateAllowedFields,
  };
}
