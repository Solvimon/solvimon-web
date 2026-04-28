import type { Environment } from '@solvimon/solvimon-types';

export type PublicEnvironment = Extract<Environment, 'TEST' | 'LIVE'>;
