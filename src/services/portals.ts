import { type PortalUrl } from './portals.types';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createPortalsService() {
    const config = useConfig();
    const request = createRequestService();

    return {
        /**
         * Get a portal url.
         */
        async getPortalUrl(portalResourceId: string) {
            return request<PortalUrl>({
                url: buildUrl(
                    config.apiUrls.transaction,
                    'portal',
                    'portal-urls',
                    portalResourceId,
                ),
            });
        },
    };
}
