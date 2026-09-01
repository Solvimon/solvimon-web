import type { Config } from './types';
import type { InternalEnvironment } from './types';

/**
 * What `@/config/internalEnvironments` resolves to in the published build, so that no internal
 * hostname is reachable from the package a customer installs. See the alias in `vite.config.ts`
 * and the `check-bundle-contents` gate that holds it.
 */
export const internalEnvironments: Partial<Record<InternalEnvironment, Config>> = {};
