import type { Customer } from '@solvimon/types';
import { ref } from 'vue';
import { createCustomerService } from '@/services/customer';
import { useService } from '@/composables/useService';

export function useCustomer({ customerId }: { customerId: Customer['id'] }) {
    const { getCustomer, updateCustomer } = createCustomerService();

    const customer = ref<Customer>();

    const { data: _getData, ...get } = useService({
        service: async () => {
            const result = await getCustomer(customerId);
            customer.value = result;
            return result;
        },
    });

    const { data: _updateData, ...update } = useService({
        service: async (payload: Partial<Customer>) => {
            const result = await updateCustomer(customerId, payload);
            customer.value = result;
            return result;
        },
    });

    return { customer, get, update };
}
