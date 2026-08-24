import type { Customer, CustomerWalletBalancesResponse } from '@solvimon/solvimon-types';
import { withExpand } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import { EXPAND_ALL } from '@/constants';

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
            query: withExpand({ expandParams: EXPAND_ALL }),
            options: { method: 'POST' },
            data: {},
        });
    }

    return {
        getCustomerWalletBalances,
    };
}
