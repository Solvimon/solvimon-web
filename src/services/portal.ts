import { type PortalUrl } from './portal.types';
import { request } from '@/utils/request';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';

/**
 * Get a portal url.
 */
export function getPortalUrl(portalResourceId: string) {
    const config = useConfig();

    return request<PortalUrl>({
        endpoint: `${config.apiUrls.transaction}/portal/portal-urls/${portalResourceId}`,
    });
}
