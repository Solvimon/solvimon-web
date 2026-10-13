import type { Ref } from 'vue';
import { PORTAL_INJECTION_KEY } from '@/components/providers/PortalProvider/PortalProvider.lib';
import type { PortalUrl } from '@/services/portals.types';
import { injectOrThrow } from '@/utils/component';

export function usePortal(): Readonly<Ref<PortalUrl>> {
    return injectOrThrow(PORTAL_INJECTION_KEY, 'PortalProvider');
}
