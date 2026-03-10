import { ref } from 'vue';
import { ApiStatus, type Amount, type Customer, type PaymentMethodOption } from '@solvimon/types';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { updateRefIfChanged } from '@/utils/ref';

export function useCustomerPaymentMethodOptions({
    customerId,
    amount,
}: {
    customerId: Customer['id'];
    amount?: Amount;
}) {
    const { getPaymentMethodOptions } = createPaymentMethodsService();

    const items = ref<PaymentMethodOption[]>([]);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);
    const error = ref<Error | null>(null);

    const fetch = async () => {
        try {
            error.value = null;
            apiStatus.value = ApiStatus.Loading;

            const response = await getPaymentMethodOptions({ customerId, amount });
            const options = response.map((entry) => entry.options).flat();

            updateRefIfChanged(items, options);
            apiStatus.value = ApiStatus.Done;
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            error.value = err;
            apiStatus.value = ApiStatus.Failed;
        }
    };

    return { error, apiStatus, items, fetch };
}
