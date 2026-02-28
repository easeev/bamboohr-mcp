import { AxiosError } from 'axios';

export enum ErrorCategory {
  AUTH = 'AUTH',
  RATE_LIMIT = 'RATE_LIMIT',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  API_ERROR = 'API_ERROR',
}

interface CategorizedError {
  category: ErrorCategory;
  message: string;
  troubleshooting: string;
  retryable: boolean;
}

const TROUBLESHOOTING: Record<ErrorCategory, string> = {
  [ErrorCategory.AUTH]:
    'Check that BAMBOO_API_TOKEN is correct and has not expired. Verify the token has the required permissions in BambooHR > Settings > API Keys.',
  [ErrorCategory.RATE_LIMIT]:
    'BambooHR rate limit exceeded. The request will be retried automatically. If this persists, reduce request frequency.',
  [ErrorCategory.NOT_FOUND]:
    'The requested resource was not found. Verify the ID is correct and the resource exists in BambooHR.',
  [ErrorCategory.VALIDATION]:
    'The request contained invalid parameters. Check that all IDs are numeric, dates are YYYY-MM-DD, and enum values are valid.',
  [ErrorCategory.NETWORK]:
    'Network error connecting to BambooHR. Check your internet connection and verify BAMBOO_COMPANY_DOMAIN is correct.',
  [ErrorCategory.TIMEOUT]:
    'Request timed out. BambooHR may be experiencing high load. The request will be retried automatically.',
  [ErrorCategory.API_ERROR]:
    'BambooHR returned an unexpected error. Check the BambooHR status page for ongoing issues.',
};

export function categorizeError(error: unknown): CategorizedError {
  if (error instanceof AxiosError) {
    const status = error.response?.status;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        category: ErrorCategory.TIMEOUT,
        message: 'Request timed out',
        troubleshooting: TROUBLESHOOTING[ErrorCategory.TIMEOUT],
        retryable: true,
      };
    }

    if (!error.response) {
      return {
        category: ErrorCategory.NETWORK,
        message: `Network error: ${error.message}`,
        troubleshooting: TROUBLESHOOTING[ErrorCategory.NETWORK],
        retryable: true,
      };
    }

    if (status === 401 || status === 403) {
      return {
        category: ErrorCategory.AUTH,
        message: `Authentication failed (${status})`,
        troubleshooting: TROUBLESHOOTING[ErrorCategory.AUTH],
        retryable: false,
      };
    }

    if (status === 404) {
      return {
        category: ErrorCategory.NOT_FOUND,
        message: 'Resource not found',
        troubleshooting: TROUBLESHOOTING[ErrorCategory.NOT_FOUND],
        retryable: false,
      };
    }

    if (status === 429) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        message: 'Rate limit exceeded',
        troubleshooting: TROUBLESHOOTING[ErrorCategory.RATE_LIMIT],
        retryable: true,
      };
    }

    if (status === 400 || status === 422) {
      return {
        category: ErrorCategory.VALIDATION,
        message: `Validation error (${status}): ${extractErrorMessage(error)}`,
        troubleshooting: TROUBLESHOOTING[ErrorCategory.VALIDATION],
        retryable: false,
      };
    }

    if (status && status >= 500) {
      return {
        category: ErrorCategory.API_ERROR,
        message: `BambooHR server error (${status})`,
        troubleshooting: TROUBLESHOOTING[ErrorCategory.API_ERROR],
        retryable: true,
      };
    }

    return {
      category: ErrorCategory.API_ERROR,
      message: `API error (${status}): ${extractErrorMessage(error)}`,
      troubleshooting: TROUBLESHOOTING[ErrorCategory.API_ERROR],
      retryable: false,
    };
  }

  if (error instanceof Error) {
    return {
      category: ErrorCategory.API_ERROR,
      message: error.message,
      troubleshooting: TROUBLESHOOTING[ErrorCategory.API_ERROR],
      retryable: false,
    };
  }

  return {
    category: ErrorCategory.API_ERROR,
    message: String(error),
    troubleshooting: TROUBLESHOOTING[ErrorCategory.API_ERROR],
    retryable: false,
  };
}

function extractErrorMessage(error: AxiosError): string {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    return (obj.message || obj.error || obj.errors || JSON.stringify(data)) as string;
  }
  return error.message;
}

export function formatErrorForUser(error: unknown): string {
  const categorized = categorizeError(error);
  return `Error [${categorized.category}]: ${categorized.message}\n\nTroubleshooting: ${categorized.troubleshooting}`;
}
