import type { Environment } from '@solvimon/types';
import { betaConfig } from './config.beta';
import { devConfig } from './config.dev';
import { liveConfig } from './config.live';
import { testConfig } from './config.test';
import type { Config } from './types';

export const getConfig = (environment: Environment): Config & { environment: Environment } => {
    const config = {
        LIVE: liveConfig,
        TEST: testConfig,
        BETA: betaConfig,
        DEV: devConfig,
    }[environment];

    return {
        environment,
        ...config,
    };
};
