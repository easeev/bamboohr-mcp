import { z } from 'zod';

// Common ID validators
export const employeeIdSchema = z
  .string()
  .regex(/^\d+$/, 'Employee ID must be a numeric string');

export const fileIdSchema = z
  .string()
  .regex(/^\d+$/, 'File ID must be a numeric string');

export const reportIdSchema = z
  .string()
  .regex(/^\d+$/, 'Report ID must be a numeric string');

export const datasetIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Dataset ID must contain only alphanumeric characters, underscores, and hyphens');

export const goalIdSchema = z
  .string()
  .regex(/^\d+$/, 'Goal ID must be a numeric string');

// Date validators
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const optionalDateSchema = dateSchema.optional();

// Enum validators
export const photoSizeSchema = z.enum(['original', 'large', 'medium', 'small', 'xs', 'tiny']);

export const timeOffStatusSchema = z.enum([
  'approved',
  'denied',
  'superceded',
  'requested',
  'canceled',
]);

export const timeOffActionSchema = z.enum(['view', 'approve', 'deny', 'cancel']);

export const reportFormatSchema = z.enum(['JSON', 'CSV', 'XML', 'PDF']);

export const metaFieldTypeSchema = z.enum([
  'list',
  'time_off_type',
  'time_off_policy',
]).optional();

// Validation helpers
export function validateEmployeeId(id: string): string {
  return employeeIdSchema.parse(id);
}

export function validateFileId(id: string): string {
  return fileIdSchema.parse(id);
}

export function validateReportId(id: string): string {
  return reportIdSchema.parse(id);
}

export function validateDatasetId(id: string): string {
  return datasetIdSchema.parse(id);
}

export function validateDate(date: string): string {
  return dateSchema.parse(date);
}

export function validatePhotoSize(size: string): string {
  return photoSizeSchema.parse(size);
}
