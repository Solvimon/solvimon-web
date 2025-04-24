import type { getAuth } from './AuthProvider.lib';

export interface AuthProviderProps {
    /**
     * The token to be user for authentication
     */
    token: string;
}

export type Auth = ReturnType<typeof getAuth>;
