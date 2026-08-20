import type {
    ApiSuccessCollectionResponse,
    WalletAutoTopUpConfig,
    WalletAutoTopUpConfigPayload,
    WalletAutoTopUpConfigsFilters,
} from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createAutoTopUpConfigsService() {
    const request = createRequestService();
    const config = useConfig();
    const BASE_URL = '/portal/auto-top-up-configs';

    /** `wallet_id` is required by the API, so there is no listing across wallets. */
    function getAutoTopUpConfigs(
        filters: WalletAutoTopUpConfigsFilters,
    ): Promise<ApiSuccessCollectionResponse<WalletAutoTopUpConfig>> {
        return request<WalletAutoTopUpConfig>({
            url: `${config.apiUrls.config}${BASE_URL}`,
            query: { ...filters },
            isCollection: true,
        });
    }

    function getAutoTopUpConfig(
        configId: WalletAutoTopUpConfig['id'],
    ): Promise<WalletAutoTopUpConfig> {
        return request<WalletAutoTopUpConfig>({
            url: `${config.apiUrls.config}${BASE_URL}/${configId}`,
        });
    }

    function createAutoTopUpConfig(
        payload: WalletAutoTopUpConfigPayload,
    ): Promise<WalletAutoTopUpConfig> {
        return request<WalletAutoTopUpConfig>({
            url: `${config.apiUrls.config}${BASE_URL}`,
            options: { method: 'POST' },
            data: payload,
        });
    }

    /** A status change rather than a delete: the config stays for the top-ups charged under it. */
    function deactivateAutoTopUpConfig(
        configId: WalletAutoTopUpConfig['id'],
    ): Promise<WalletAutoTopUpConfig> {
        return request<WalletAutoTopUpConfig>({
            url: `${config.apiUrls.config}${BASE_URL}/${configId}/deactivate`,
            options: { method: 'POST' },
        });
    }

    return {
        getAutoTopUpConfigs,
        getAutoTopUpConfig,
        createAutoTopUpConfig,
        deactivateAutoTopUpConfig,
    };
}
