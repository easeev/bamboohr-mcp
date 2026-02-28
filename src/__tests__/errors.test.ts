import { AxiosError, AxiosHeaders } from 'axios';
import { categorizeError, ErrorCategory, formatErrorForUser } from '../errors';

function makeAxiosError(status?: number, code?: string, data?: unknown): AxiosError {
  const headers = new AxiosHeaders();
  const error = new AxiosError(
    'test error',
    code || 'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    status ? {
      status,
      statusText: 'Error',
      headers: {},
      config: { headers },
      data: data || 'error',
    } : undefined
  );
  return error;
}

describe('categorizeError', () => {
  it('categorizes 401 as AUTH', () => {
    const result = categorizeError(makeAxiosError(401));
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.retryable).toBe(false);
  });

  it('categorizes 403 as AUTH', () => {
    const result = categorizeError(makeAxiosError(403));
    expect(result.category).toBe(ErrorCategory.AUTH);
    expect(result.retryable).toBe(false);
  });

  it('categorizes 404 as NOT_FOUND', () => {
    const result = categorizeError(makeAxiosError(404));
    expect(result.category).toBe(ErrorCategory.NOT_FOUND);
    expect(result.retryable).toBe(false);
  });

  it('categorizes 429 as RATE_LIMIT', () => {
    const result = categorizeError(makeAxiosError(429));
    expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
    expect(result.retryable).toBe(true);
  });

  it('categorizes 400 as VALIDATION', () => {
    const result = categorizeError(makeAxiosError(400));
    expect(result.category).toBe(ErrorCategory.VALIDATION);
    expect(result.retryable).toBe(false);
  });

  it('categorizes 422 as VALIDATION', () => {
    const result = categorizeError(makeAxiosError(422));
    expect(result.category).toBe(ErrorCategory.VALIDATION);
    expect(result.retryable).toBe(false);
  });

  it('categorizes 500 as API_ERROR', () => {
    const result = categorizeError(makeAxiosError(500));
    expect(result.category).toBe(ErrorCategory.API_ERROR);
    expect(result.retryable).toBe(true);
  });

  it('categorizes ECONNABORTED as TIMEOUT', () => {
    const result = categorizeError(makeAxiosError(undefined, 'ECONNABORTED'));
    expect(result.category).toBe(ErrorCategory.TIMEOUT);
    expect(result.retryable).toBe(true);
  });

  it('categorizes ETIMEDOUT as TIMEOUT', () => {
    const result = categorizeError(makeAxiosError(undefined, 'ETIMEDOUT'));
    expect(result.category).toBe(ErrorCategory.TIMEOUT);
    expect(result.retryable).toBe(true);
  });

  it('categorizes network error (no response) as NETWORK', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    const result = categorizeError(error);
    expect(result.category).toBe(ErrorCategory.NETWORK);
    expect(result.retryable).toBe(true);
  });

  it('categorizes generic Error as API_ERROR', () => {
    const result = categorizeError(new Error('something went wrong'));
    expect(result.category).toBe(ErrorCategory.API_ERROR);
    expect(result.message).toBe('something went wrong');
    expect(result.retryable).toBe(false);
  });

  it('categorizes unknown as API_ERROR', () => {
    const result = categorizeError('string error');
    expect(result.category).toBe(ErrorCategory.API_ERROR);
    expect(result.message).toBe('string error');
  });

  it('extracts message from response data object', () => {
    const result = categorizeError(makeAxiosError(400, undefined, { message: 'bad field' }));
    expect(result.message).toContain('bad field');
  });
});

describe('formatErrorForUser', () => {
  it('returns formatted error with troubleshooting', () => {
    const msg = formatErrorForUser(makeAxiosError(401));
    expect(msg).toContain('AUTH');
    expect(msg).toContain('Troubleshooting');
    expect(msg).toContain('BAMBOO_API_TOKEN');
  });
});
