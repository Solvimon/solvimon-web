import type { Token } from '@solvimon/types';
import { request } from '@/utils/request';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';
import type { Config } from '@/config/types';

export function getAccessToken(tokenUserName: string) {
    const config = useConfig();

    return request<Token>({
        endpoint: `${config.apiUrls.identity}/oauth/token`,
        options: { method: 'POST', enableAccessToken: false },
        data: { token_alias: tokenUserName },
    });
}

export function refreshAccessToken(config: Config) {
    return request<Token>({
        endpoint: `${config.apiUrls.identity}/oauth/refresh-token`,
        options: { method: 'POST' },
    });
}
