import { betaConfig } from './config.beta';
import { devConfig } from './config.dev';
import type { Config } from './types';
import type { InternalEnvironment } from './types';

/**
 * Environments that exist for developing this package and must never reach the published one:
 * their hostnames and ports are internal infrastructure.
 *
 * The published build never loads this module. `vite.config.ts` aliases it to
 * `internalEnvironments.published.ts` unless `SOLVIMON_INTERNAL_ENVIRONMENTS=1` is set, so these
 * imports are absent from the module graph rather than trimmed out of it by the bundler — there is
 * no tree-shaking result to re-verify on each build.
 */
export const internalEnvironments: Partial<Record<InternalEnvironment, Config>> = {
    BETA: betaConfig,
    DEV: devConfig,
};
