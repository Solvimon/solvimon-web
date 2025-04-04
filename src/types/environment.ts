import type { Environment } from '@solvimon/types';

export type PublicEnvironment = Extract<Environment, 'TEST' | 'LIVE'>;
