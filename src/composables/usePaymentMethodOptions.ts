import {
    ApiStatus,
    type Amount,
    type CountryCode,
    type PaymentMethodOptionsResponse,
    type PricingPlanSubscription,
} from '@solvimon/types';
import { computed, ref } from 'vue';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export const usePaymentMethodOptions = () => {
    const paymentMethodOptions = ref<PaymentMethodOptionsResponse>([]);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);

    const { getPaymentMethodOptions } = createPaymentMethodsService();

    const loadPaymentMethodOptions = async ({
        subscriptionId,
        country,
        amount,
    }: {
        subscriptionId: PricingPlanSubscription['id'];
        country: CountryCode;
        amount?: Amount;
    }) => {
        try {
            apiStatus.value = ApiStatus.Loading;
            const response = await getPaymentMethodOptions({
                subscriptionId,
                country,
                amount,
            });

            paymentMethodOptions.value = response;
        } catch {
            apiStatus.value = ApiStatus.Failed;
        } finally {
            apiStatus.value = ApiStatus.Done;
        }
    };

    return {
        loadPaymentMethodOptions,
        paymentMethodOptions,
        isPending: computed(() => apiStatus.value === ApiStatus.Loading),
    };
};
