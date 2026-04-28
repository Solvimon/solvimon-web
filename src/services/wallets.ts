import type { Customer, CustomerWalletBalancesResponse } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

interface WalletsService {
    getCustomerWalletBalances: (
        customerId: Customer['id'],
    ) => Promise<CustomerWalletBalancesResponse>;
}

export function createWalletsService(): WalletsService {
    const request = createRequestService();
    const config = useConfig();

    function getCustomerWalletBalances(
        customerId: Customer['id'],
    ): Promise<CustomerWalletBalancesResponse> {
        return request<CustomerWalletBalancesResponse>({
            url: `${config.apiUrls.config}/portal/customers/${customerId}/wallets/balance`,
            options: { method: 'POST' },
            data: {},
        });
    }

    return {
        getCustomerWalletBalances,
    };
}
