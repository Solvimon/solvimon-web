import type { Customer, CustomerWalletBalancesResponse } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import { createWalletsService } from '@/services/wallets';
import { useService } from '@/composables/useService';

export function useCustomerWalletBalances({ customerId }: { customerId: Customer['id'] }) {
    const { getCustomerWalletBalances } = createWalletsService();

    const { data, execute, apiStatus, error, isPending } = useService({
        service: () => getCustomerWalletBalances(customerId),
    });

    const walletBalances = computed<CustomerWalletBalancesResponse | null>(
        () => data.value ?? null,
    );

    return { walletBalances, apiStatus, error, fetch: execute, isPending };
}
