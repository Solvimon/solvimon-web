import type { Token } from '@solvimon/solvimon-types';
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
                // A 401 is the expected end of a session; `AuthProvider` raises SESSION_EXPIRED.
                options: { method: 'POST', expectedStatusCodes: [401] },
            });
        },
    };
}
