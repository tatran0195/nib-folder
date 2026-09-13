import { z } from 'zod';

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

/**
 * Core response DTO schemas (deliberate public wire contracts omitting internal DB details).
 * Inspired by Avkash's drizzle-zod DTO pattern.
 */
export const projectResponseDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  subdomain: z.string().nullable().optional(),
  customDomain: z.string().nullable().optional(),
  customDomainVerified: z.boolean().optional(),
  visibility: z.string().optional(),
  organizationId: z.string(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export const pageResponseDto = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string().optional(),
  order: z.number().optional(),
  parentId: z.string().nullable().optional(),
  projectId: z.string(),
  branchId: z.string().nullable().optional(),
  language: z.string().optional(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});

export const deploymentResponseDto = z.object({
  id: z.string(),
  status: z.string(),
  projectId: z.string(),
  branchId: z.string().nullable().optional(),
  commitSha: z.string().nullable().optional(),
  environment: z.string().optional(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).optional(),
});
