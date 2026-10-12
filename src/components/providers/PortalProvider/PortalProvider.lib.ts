import { type InjectionKey, onMounted, ref } from 'vue';
import { parseToken } from '@/utils/token';
import { createPortalsService } from '@/services/portals';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import type { PortalUrl } from '@/services/portals.types';

export const PORTAL_INJECTION_KEY: InjectionKey<ReturnType<typeof getPortal>> =
    Symbol('portalObject');

export const getPortal = ({
    token,
    allowedPortalTypes,
}: {
    token: string;
    allowedPortalTypes?: PortalUrl['type'][];
}) => {
    const { getPortalUrl } = createPortalsService();
    const logger = useLogger();

    const portal = ref<PortalUrl>();

    let parsedToken: ReturnType<typeof parseToken>;
    try {
        parsedToken = parseToken(token);
    } catch (err) {
        logger.error('INVALID_TOKEN', 'Failed to parse the portal token', {}, err);
        return portal;
    }

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

            if (allowedPortalTypes && !allowedPortalTypes.includes(portal.value.type)) {
                throw Error(`Incorrect portal url types: ${portal.value.type}`);
            }
        } catch (err) {
            logger.error('RESOURCE_REVOKED', 'Failed to load portal resource', {}, err);
        }
    };

    onMounted(async () => {
        await getPortalObject();
    });

    return portal;
};
