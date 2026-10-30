import { computed, type Ref } from 'vue';
import type { PortalUrl } from '@solvimon/solvimon-types';
import { PORTAL_INJECTION_KEY } from '@/components/providers/PortalProvider/PortalProvider.lib';
import { injectOrThrow } from '@/utils/component';
import { CodedError } from '@/utils/error';

/** The portal of an element that does not take a checkout session link, which PortalProvider refuses. */
export function usePortal(): Readonly<Ref<PortalUrl>> {
    const portal = injectOrThrow(PORTAL_INJECTION_KEY, 'PortalProvider');

    return computed(() => {
        const value = portal.value;
        if (value.type === 'CHECKOUT_SESSION') {
            throw new CodedError('PORTAL_TYPE_NOT_ALLOWED', 'Unexpected checkout session portal');
        }
        return value;
    });
}
