import type { PortalObject } from '@/types/checkoutSession';

export type PortalProviderProps = {
    /**
     * The portal object to be used for the portal.
     */
    portalObject: PortalObject;
    /**
     * The allowed portal types.
     */
    allowedPortalTypes?: PortalObject['type'][];
};
