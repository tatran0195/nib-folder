import type { z } from 'zod';

/**
 * Serializes raw database records against an explicit Zod response DTO schema.
 * Ensures internal database columns, unmapped relations, and unsafe fields are stripped.
 * Inspired by Avkash's `serialize(dto, data)` pattern.
 */
export function serialize<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

/**
 * Normalizes Date objects or timestamp strings into consistent ISO 8601 strings.
 */
export function toIsoString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}
