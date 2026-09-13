import { createApp } from './create-app';
import { OPEN_MODULES } from './modules/registry';

/**
 * The assembled Nibleaf application.
 * Directly modeled on Avkash's `apps/api/src/app.ts`.
 */
export const app = createApp(OPEN_MODULES);

export default app;

export type AppType = typeof app;
