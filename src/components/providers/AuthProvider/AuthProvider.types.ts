import type { Ref } from 'vue';
import type { getAuth } from './AuthProvider.lib';

export interface AuthProviderProps {
    /**
     * The token to be used for authentication
     */
    token: string;
}

export type Auth = ReturnType<typeof getAuth>;

export type AuthInstance = {
    accessToken: Ref<string | undefined>;
    refCount: number;
    started: boolean;
    start: () => void;
    stop: () => void;
};
