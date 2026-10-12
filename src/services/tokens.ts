import type { Token } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createTokensService({ logger }: { logger?: Logger } = {}) {
    const config = useConfig();
    const request = createRequestService({
        enableAccessCheck: false,
        includeRefreshCookie: true,
        logger,
    });

    return {
        getAccessToken(tokenUserName: string) {
            return request<Token>({
                url: buildUrl(config.apiUrls.identity, 'oauth', 'token'),
                // Sent with credentials, so the browser keeps the `refresh-token` cookie this
                // response sets; without it the session cannot renew once the token expires.
                options: { method: 'POST' },
                data: { token_alias: tokenUserName },
            });
        },
        refreshAccessToken() {
            return request<Token>({
                url: buildUrl(config.apiUrls.identity, 'oauth', 'refresh-token'),
                // The endpoint authenticates on the `refresh-token` cookie alone, so the
                // request has to carry it. A 401 is the expected end of a session;
                // `AuthProvider` raises SESSION_EXPIRED.
                options: { method: 'POST', expectedStatusCodes: [401] },
            });
        },
    };
}
