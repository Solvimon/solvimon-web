import type { Config } from './types';

export const devConfig: Config = {
    apiUrls: {
        identity:'https://dev.solvimon.com:10016/v1',
        config: 'https://dev.solvimon.com:10010/v1',
        transaction: 'https://dev.solvimon.com:10014/v1',
        event: 'https://dev.solvimon.com:10012/v1',
    },
};