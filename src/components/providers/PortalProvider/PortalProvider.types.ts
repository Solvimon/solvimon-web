import type { PortalUrl } from '@solvimon/solvimon-types';

export type PortalProviderProps = {
    /**
     * The portal object to be used for the portal.
     */
    portalObject: PortalUrl;
    /**
     * The allowed portal types.
     */
    allowedPortalTypes?: PortalUrl['type'][];
};
