import type { Environment } from '@solvimon/types';
import type { getConfig } from '@/config/lib';

export interface ConfigProviderProps {
    /**
     * The solvimon environment to be used
     */
    environment: Environment;
    /**
     * The custom element name to be used
     */
    customElementName: string;
}

export type Config = ReturnType<typeof getConfig>;
