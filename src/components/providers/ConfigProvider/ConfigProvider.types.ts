import type { Environment } from '@solvimon/types';
import type { getConfig } from '@/config/lib';

export interface ConfigProviderProps {
    /**
     * The solvimon environment to be used
     */
    environment: Environment;
}

export type Config = ReturnType<typeof getConfig>;
