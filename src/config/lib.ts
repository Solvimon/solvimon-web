import type { Environment } from '@solvimon/types';
import { betaConfig } from './config.beta';
import { devConfig } from './config.dev';
import { liveConfig } from './config.live';
import { testConfig } from './config.test';
import { ciConfig } from './config.ci';

import type { Config } from './types';

export const getConfig = (
    environment: Environment,
    customElementName: string,
): Config & { environment: Environment; customElementName: string } => {
    const config = {
        CI: ciConfig,
        LIVE: liveConfig,
        TEST: testConfig,
        BETA: betaConfig,
        DEV: devConfig,
    }[environment];

    return {
        environment,
        customElementName,
        ...config,
    };
};
