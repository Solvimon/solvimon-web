import { type PortalUrl } from './portals.types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';

export function createPortalsService() {
    const config = useConfig();
    const request = createRequestService();

    return {
        /**
         * Get a portal url.
         */
        getPortalUrl(portalResourceId: string) {
            return request<PortalUrl>({
                url: `${config.apiUrls.transaction}/portal/portal-urls/${portalResourceId}`,
            });
        },
    };
}
