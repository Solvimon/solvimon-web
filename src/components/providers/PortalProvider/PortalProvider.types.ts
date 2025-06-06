import type { PortalUrl } from '@/services/portals.types';

export interface PortalProviderProps {
    token: string;
    allowedPortalTypes?: PortalUrl['type'][];
}
