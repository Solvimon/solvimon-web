import { type InjectionKey, onMounted, ref } from 'vue';
import { parseToken } from '@/utils/token';
import { getPortalUrl } from '@/services/portal';
import type { PortalUrl } from '@/services/portal.types';

export const PORTAL_INJECTION_KEY: InjectionKey<ReturnType<typeof getPortal>> =
    Symbol('portalObject');

export const getPortal = (token: string) => {
    const portal = ref<PortalUrl>();
    const parsedToken = parseToken(token);

    const getPortalObject = async () => {
        try {
            portal.value = await getPortalUrl(parsedToken.portalUrlResourceId);

            if (!token || !parsedToken.portalUrlResourceId) {
                throw Error('Failed getting portal url');
            }

            /**
             * Check if we can actually get the portal url and check if the resource is published.
             */
            if (!portal.value || portal.value.status !== 'PUBLISHED') {
                throw Error('Resource unavailable');
            }

            /**
             * Check portal url response validity with the expected type.
             */
            if (portal.value.type !== 'CUSTOMER') {
                throw Error(`Expected portal url type CUSTOMER but got type ${portal.value.type}`);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.log(err);
        }
    };

    onMounted(async () => {
        await getPortalObject();
    });

    return portal;
};
