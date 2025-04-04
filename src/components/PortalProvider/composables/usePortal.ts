import { inject } from 'vue';
import { PORTAL_INJECTION_KEY } from '@/components/PortalProvider/PortalProvider.lib';

export function usePortal() {
    const portal = inject(PORTAL_INJECTION_KEY);

    if (!portal) {
        throw new Error('PortalProvider is not provided');
    }

    return portal;
}
