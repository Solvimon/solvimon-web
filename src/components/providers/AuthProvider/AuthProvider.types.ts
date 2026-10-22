import type { getAuth } from './AuthProvider.lib';
import type { PortalAuthentication } from '@/types/portalAuthentication';

export interface AuthProviderProps {
    /**
     * The token to be used for authentication
     */
    token: string;
    /** `SIGNED_TOKEN` when `token` is a handle to exchange rather than an identity token. */
    authentication?: PortalAuthentication;
}

export type Auth = ReturnType<typeof getAuth>;
