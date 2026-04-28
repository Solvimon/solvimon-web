import type { Amount, Customer, PaymentMethodOption } from '@solvimon/solvimon-types';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { useService } from '@/composables/useService';

export function useCustomerPaymentMethodOptions({
    customerId,
    amount,
}: {
    customerId: Customer['id'];
    amount?: Amount;
}) {
    const { getPaymentMethodOptions } = createPaymentMethodsService();
    const { data, execute, error, apiStatus, isPending } = useService({
        initialValue: [] as PaymentMethodOption[],
        service: async () => {
            const response = await getPaymentMethodOptions({ customerId, amount });
            return response.flatMap((entry) => entry.options ?? []);
        },
    });

    return { error, apiStatus, items: data, fetch: execute, isPending };
}
