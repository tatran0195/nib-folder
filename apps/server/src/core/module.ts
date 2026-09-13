import type { Hono } from 'hono';
import type { HonoEnv } from '@/lib/hono/context';

/**
 * Manifest contract for self-contained domain modules in Nibleaf.
 *
 * Each module declares its routes and metadata.
 * The central app factory registers active modules declaratively from the registry,
 * eliminating hardcoded route chaining across scattered files.
 */
export interface NibleafModule {
  /** Unique key identifying the domain (e.g., 'pages', 'projects', 'deployments'). */
  key: string;

  /** Human-readable title for documentation and diagnostics. */
  title: string;

  /** Brief description of the module's responsibilities. */
  description?: string;

  /**
   * Protected app-facing routes mounted under `/api/app`.
   * Requires workspace / user authentication.
   */
  appRoutes?: (router: Hono<HonoEnv>) => void;

  /**
   * Public-facing reader or webhook routes mounted under `/api/public`.
   */
  publicRoutes?: (router: Hono<HonoEnv>) => void;

  /**
   * Platform operator routes mounted under `/api/admin`.
   */
  adminRoutes?: (router: Hono<HonoEnv>) => void;

  /**
   * Model Context Protocol (MCP) tool registrations.
   */
  mcpRoutes?: (router: Hono<HonoEnv>) => void;
}
