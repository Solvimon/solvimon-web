import type {
    ApiSuccessCollectionResponse,
    WalletAutoTopUpConfig,
    WalletAutoTopUpConfigPayload,
    WalletAutoTopUpConfigsFilters,
} from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createAutoTopUpConfigsService() {
    const request = createRequestService();
    const config = useConfig();
    const BASE_PATH = ['portal', 'auto-top-up-configs'];

    /** `wallet_id` is required by the API, so there is no listing across wallets. */
    function getAutoTopUpConfigs(
        filters: WalletAutoTopUpConfigsFilters,
    ): Promise<ApiSuccessCollectionResponse<WalletAutoTopUpConfig>> {
        return request<WalletAutoTopUpConfig>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            query: { ...filters },
            isCollection: true,
        });
    }

    async function getAutoTopUpConfig(
        configId: NonNullable<WalletAutoTopUpConfig['id']>,
    ): Promise<WalletAutoTopUpConfig> {
        return request<WalletAutoTopUpConfig>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, configId),
        });
    }

    function createAutoTopUpConfig(
        payload: WalletAutoTopUpConfigPayload,
    ): Promise<WalletAutoTopUpConfig> {
        return request<WalletAutoTopUpConfig>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            options: { method: 'POST' },
            data: payload,
        });
    }

    /** A status change rather than a delete: the config stays for the top-ups charged under it. */
    async function deactivateAutoTopUpConfig(
        configId: NonNullable<WalletAutoTopUpConfig['id']>,
    ): Promise<WalletAutoTopUpConfig> {
        return request<WalletAutoTopUpConfig>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, configId, 'deactivate'),
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
