import { ApiStatus, type Customer, type CustomerWalletBalancesResponse } from '@solvimon/types';
import { computed, ref } from 'vue';
import { isApiError } from '@solvimon/ui';
import { createWalletsService } from '@/services/wallets';
import { updateRefIfChanged } from '@/utils/ref';

export function useCustomerWalletBalances({ customerId }: { customerId: Customer['id'] }) {
    const { getCustomerWalletBalances } = createWalletsService();

    const walletBalances = ref<CustomerWalletBalancesResponse | null>(null);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);
    const error = ref<string | undefined>();
    const isPending = computed(() => apiStatus.value === ApiStatus.Loading);

    const fetch = async () => {
        try {
            apiStatus.value = ApiStatus.Loading;
            error.value = undefined;

            const response = await getCustomerWalletBalances(customerId);

            updateRefIfChanged(walletBalances, response);
            apiStatus.value = ApiStatus.Done;
        } catch (err) {
            if (isApiError(err)) {
                error.value = err.message;
            } else {
                error.value = undefined;
            }

            apiStatus.value = ApiStatus.Failed;
            return undefined;
        }
    };

    return { walletBalances, apiStatus, error, fetch, isPending };
}
