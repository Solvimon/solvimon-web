import type { Token } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type { PortalToken } from '@/types/portalToken';

export function createTokensService({ logger }: { logger?: Logger } = {}) {
    const config = useConfig();
    const request = createRequestService({
        enableAccessCheck: false,
        includeRefreshCookie: true,
        logger,
    });
    // The handle is the only credential the exchange takes: no bearer and no cookie.
    const exchangeRequest = createRequestService({ enableAccessCheck: false, logger });

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
        async exchangeHandle(handle: string): Promise<Token> {
            const response = await exchangeRequest<PortalToken>({
                url: buildUrl(config.apiUrls.transaction, 'portal', 'token'),
                // `AuthProvider` handles each of these: a dead link (410), an unknown handle (401)
                // and a link the API could not verify for now (503).
                options: { method: 'POST', expectedStatusCodes: [401, 410, 503] },
                data: { handle },
            });

            return {
                access_token: response.access_token,
                expires_in: response.access_token_expires_in,
                token_type: response.token_type,
            };
        },
    };
}
