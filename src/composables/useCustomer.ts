import { ApiStatus, type Customer } from '@solvimon/types';
import { computed, ref } from 'vue';
import { createCustomerService } from '@/services/customer';
import { updateRefIfChanged } from '@/utils/ref';

export function useCustomer({ customerId }: { customerId: Customer['id'] }) {
    const { getCustomer } = createCustomerService();

    const customer = ref<Customer | null>(null);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);
    const error = ref<Error | null>(null);
    const isPending = computed(() => apiStatus.value === ApiStatus.Loading);

    const fetch = async () => {
        try {
            apiStatus.value = ApiStatus.Loading;
            error.value = null;

            const response = await getCustomer(customerId);

            updateRefIfChanged(customer, response);
            apiStatus.value = ApiStatus.Done;
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            error.value = err;
            apiStatus.value = ApiStatus.Failed;
        }
    };

    return { customer, apiStatus, error, fetch, isPending };
}
