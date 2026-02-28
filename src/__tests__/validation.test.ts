import {
  validateEmployeeId,
  validateFileId,
  validateReportId,
  validateDatasetId,
  validateDate,
  validatePhotoSize,
} from '../validation';

describe('validateEmployeeId', () => {
  it('accepts valid numeric ID', () => {
    expect(validateEmployeeId('123')).toBe('123');
  });

  it('rejects non-numeric ID', () => {
    expect(() => validateEmployeeId('abc')).toThrow();
  });

  it('rejects ID with special characters', () => {
    expect(() => validateEmployeeId('12-3')).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateEmployeeId('')).toThrow();
  });
});

describe('validateFileId', () => {
  it('accepts valid numeric ID', () => {
    expect(validateFileId('456')).toBe('456');
  });

  it('rejects non-numeric', () => {
    expect(() => validateFileId('abc')).toThrow();
  });
});

describe('validateReportId', () => {
  it('accepts valid numeric ID', () => {
    expect(validateReportId('789')).toBe('789');
  });

  it('rejects non-numeric', () => {
    expect(() => validateReportId('report-1')).toThrow();
  });
});

describe('validateDatasetId', () => {
  it('accepts alphanumeric with hyphens and underscores', () => {
    expect(validateDatasetId('employee_data')).toBe('employee_data');
    expect(validateDatasetId('time-off-2024')).toBe('time-off-2024');
    expect(validateDatasetId('ABC123')).toBe('ABC123');
  });

  it('rejects special characters', () => {
    expect(() => validateDatasetId('data.set')).toThrow();
    expect(() => validateDatasetId('data/set')).toThrow();
    expect(() => validateDatasetId('data set')).toThrow();
  });
});

describe('validateDate', () => {
  it('accepts valid YYYY-MM-DD date', () => {
    expect(validateDate('2026-03-15')).toBe('2026-03-15');
  });

  it('rejects invalid format', () => {
    expect(() => validateDate('03/15/2026')).toThrow();
    expect(() => validateDate('2026-3-15')).toThrow();
    expect(() => validateDate('not-a-date')).toThrow();
  });
});

describe('validatePhotoSize', () => {
  it('accepts valid sizes', () => {
    expect(validatePhotoSize('original')).toBe('original');
    expect(validatePhotoSize('medium')).toBe('medium');
    expect(validatePhotoSize('tiny')).toBe('tiny');
  });

  it('rejects invalid sizes', () => {
    expect(() => validatePhotoSize('huge')).toThrow();
    expect(() => validatePhotoSize('')).toThrow();
  });
});
