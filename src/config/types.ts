import type { Environment } from '@solvimon/solvimon-types';

export interface Config {
    apiUrls: {
        identity: string;
        config: string;
        transaction: string;
        event: string;
    };
}

/** The environments the published package supports, and the only ones a host may name. */
export type PublicEnvironment = Extract<Environment, 'TEST' | 'LIVE'>;

/** Everything else in the union: development infrastructure, stripped from the published build. */
export type InternalEnvironment = Exclude<Environment, PublicEnvironment>;
