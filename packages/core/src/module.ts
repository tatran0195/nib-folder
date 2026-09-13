import type { NibleafModule as BaseNibleafModule } from '@nibleaf/shared';
import type { Hono } from 'hono';
import type { HonoEnv } from './types';

/** Server-specialized NibleafModule bound to Hono router environment */
export type NibleafModule = BaseNibleafModule<Hono<HonoEnv>>;

export type { JobDefinition, ScheduledJob } from '@nibleaf/shared';
