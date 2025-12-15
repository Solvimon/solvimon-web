import type { PortalUrl } from '@/services/portals.types';

export type PortalProviderProps = {
    /**
     * The token to be used for the portal.
     */
    token?: string;
    /**
     * The portal object to be used for the portal.
     */
    portalObject?: PortalUrl;
    /**
     * The allowed portal types.
     */
    allowedPortalTypes?: PortalUrl['type'][];
};
