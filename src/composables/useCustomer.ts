import type { Customer } from '@solvimon/types';
import { createCustomerService } from '@/services/customer';
import { useService } from '@/composables/useService';

export function useCustomer({ customerId }: { customerId: Customer['id'] }) {
    const { getCustomer } = createCustomerService();
    const { data, fetch, apiStatus, error, isPending } = useService({
        service: () => getCustomer(customerId),
    });

    return { data, apiStatus, error, fetch, isPending };
}
