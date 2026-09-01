import type { Environment } from '@solvimon/solvimon-types';
import { liveConfig } from './config.live';
import { testConfig } from './config.test';
import type { Config, PublicEnvironment } from './types';
import { internalEnvironments } from '@/config/internalEnvironments';

const publicEnvironments: Record<PublicEnvironment, Config> = {
    LIVE: liveConfig,
    TEST: testConfig,
};

/**
 * `internalEnvironments` is empty in the published build, so BETA and DEV resolve to nothing there
 * and are rejected below like any other unknown value.
 */
const environmentConfigs: Partial<Record<Environment, Config>> = {
    ...publicEnvironments,
    ...internalEnvironments,
};

export const isSupportedEnvironment = (environment: string): environment is Environment =>
    Object.hasOwn(environmentConfigs, environment);

export const getConfig = (environment: Environment): Config & { environment: Environment } => {
    const config = environmentConfigs[environment];

    // A custom element takes its attributes as strings, so no type stops a host writing
    // `environment="DEV"` against the published package. Refused outright rather than resolved to a
    // default: silently pointing a misconfigured integration at the wrong environment is worse for
    // a billing SDK than failing where the cause is still visible.
    if (!config) {
        throw new Error(
            `Unknown Solvimon environment "${environment}". Supported environments are ${Object.keys(
                environmentConfigs,
            )
                .sort()
                .join(', ')}.`,
        );
    }

    return {
        environment,
        ...config,
    };
};
