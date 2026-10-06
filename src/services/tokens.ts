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
                // `include` so the browser keeps the `refresh-token` cookie this response sets;
                // without it the session has no way to renew itself once the token expires.
                options: { method: 'POST', credentials: 'include' },
                data: { token_alias: tokenUserName },
            });
        },
        refreshAccessToken() {
            return request<Token>({
                url: `${config.apiUrls.identity}/oauth/refresh-token`,
                // The endpoint authenticates on the `refresh-token` cookie alone, so the
                // request has to carry it. A 401 is the expected end of a session;
                // `AuthProvider` raises SESSION_EXPIRED.
                options: { method: 'POST', expectedStatusCodes: [401], credentials: 'include' },
            });
        },
    };
}
