import type { getAuth } from './AuthProvider.lib';
import type { PortalAuthentication } from '@/types/portalAuthentication';
import type { PortalToken } from '@/types/portalToken';

export interface AuthProviderProps {
    /**
     * The token to be used for authentication
     */
    token: string;
    /** `SIGNED_TOKEN` when `token` is a handle to exchange rather than an identity token. */
    authentication?: PortalAuthentication;
    /**
     * The response of an exchange of the handle the host already made, as it is, which the element
     * then signs in with instead of exchanging the handle itself. When the API rejects its token, the
     * element exchanges the handle. Only read for a `SIGNED_TOKEN` portal object, and only when the
     * element signs in. An object, because a custom element copies a string property into an HTML
     * attribute, where a bearer token would sit in the page for anything that reads it.
     */
    portalToken?: PortalToken;
}

export type Auth = ReturnType<typeof getAuth>;
