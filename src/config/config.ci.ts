import { TEST_APP_HOST, TEST_APP_PORT } from '../../global.config';
import type { Config } from './types';

export const ciConfig: Config = {
    apiUrls: {
        identity: `https://${TEST_APP_HOST}:${TEST_APP_PORT}/identity`,
        config: `https://${TEST_APP_HOST}:${TEST_APP_PORT}/config`,
        transaction: `https://${TEST_APP_HOST}:${TEST_APP_PORT}/transaction`,
        event: `https://${TEST_APP_HOST}:${TEST_APP_PORT}/event`,
    },
};
