import { inject, type Ref } from 'vue';
import { PORTAL_INJECTION_KEY } from '@/components/providers/PortalProvider/PortalProvider.lib';
import type { PortalUrl } from '@/services/portals.types';

export function usePortal<T extends Ref<PortalUrl>>() {
    const portal = inject<T>(PORTAL_INJECTION_KEY);

    if (!portal) {
        throw new Error('PortalProvider is not provided');
    }

    return portal;
}
