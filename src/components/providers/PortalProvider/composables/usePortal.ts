import { inject, type Ref } from 'vue';
import { PORTAL_INJECTION_KEY } from '@/components/providers/PortalProvider/PortalProvider.lib';
import type { PortalUrl } from '@/services/portals.types';

export function usePortal(): Readonly<Ref<PortalUrl>> {
    const portal = inject(PORTAL_INJECTION_KEY);

    if (!portal) {
        throw new Error('PortalProvider is not provided');
    }

    return portal;
}
