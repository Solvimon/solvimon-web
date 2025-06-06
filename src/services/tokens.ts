import type { Token } from '@solvimon/types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createTokensService() {
    const config = useConfig();
    const request = createRequestService({ enableAccessCheck: false });

    return {
        getAccessToken(tokenUserName: string) {
            return request<Token>({
                url: `${config.apiUrls.identity}/oauth/token`,
                options: { method: 'POST' },
                data: { token_alias: tokenUserName },
            });
        },
        refreshAccessToken() {
            return request<Token>({
                url: `${config.apiUrls.identity}/oauth/refresh-token`,
                options: { method: 'POST' },
            });
        },
    };
}
