/**
 * A repeatable job or background schedule.
 */
export interface ScheduledJob {
  /** Unique name within the module: '<moduleKey>.<purpose>'. */
  name: string;
  /** Cron expression (e.g. '0 3 * * *') or recurrence string. */
  cron?: string;
  /** Interval in milliseconds if running as an unref interval timer. */
  intervalMs?: number;
  /** Job executor function. */
  run: () => Promise<unknown> | unknown;
}

/**
 * A BullMQ queue job processor definition.
 */
export interface JobDefinition<TResult = unknown> {
  /** Queue name (e.g. QueueNames.PUBLISH, QueueNames.SEARCH, QueueNames.EMAIL). */
  queueName: string;
  /** Processor function for the job. */
  handler: (job: never) => Promise<TResult>;
}

/**
 * The module manifest interface.
 * Matches Avkash's `AvkashModule` design: a module declares everything the platform mounts for it.
 * Generic `TRouter` keeps shared dependency-free.
 */
export interface NibleafModule<TRouter = unknown> {
  /** Stable, unique key identifying the domain (e.g., 'projects', 'deployments', 'search'). */
  key: string;
  /** Human-readable title. */
  title: string;
  /** Brief description of domain responsibilities. */
  description?: string;
  /** Entitlement key required to enable; null = always-on core. */
  entitlement?: string | null;
  /** Module keys this module depends on; validated at boot. */
  dependsOn?: string[];

  /** Unified routes mounting function (called by createApp). */
  routes?: (router: TRouter) => void;
  /** App-facing authenticated routes mounted under `/api/app`. */
  appRoutes?: (router: TRouter) => void;
  /** Public-facing routes mounted under `/api/public`. */
  publicRoutes?: (router: TRouter) => void;
  /** Platform operator routes mounted under `/api/admin`. */
  adminRoutes?: (router: TRouter) => void;
  /** MCP tool routes mounted under `/mcp`. */
  mcpRoutes?: (router: TRouter) => void;

  /** Background queue job processors. */
  jobs?: JobDefinition[];
  /** Repeatable or interval background maintenance schedules. */
  schedules?: ScheduledJob[];
}
