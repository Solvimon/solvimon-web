import type { Ref } from 'vue';
import type { PortalUrl } from '@solvimon/solvimon-types';
import { PORTAL_INJECTION_KEY } from '@/components/providers/PortalProvider/PortalProvider.lib';
import { injectOrThrow } from '@/utils/component';

export function usePortal(): Readonly<Ref<PortalUrl>> {
    return injectOrThrow(PORTAL_INJECTION_KEY, 'PortalProvider');
}
