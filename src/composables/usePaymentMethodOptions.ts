import type {
    CountryCode,
    PaymentMethodOptionsResponse,
    PricingPlanSubscription,
} from '@solvimon/types';
import { ref } from 'vue';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export const usePaymentMethodOptions = () => {
    const paymentMethodOptions = ref<PaymentMethodOptionsResponse>([]);

    const { getPaymentMethodOptions } = createPaymentMethodsService();

    const loadPaymentMethodOptions = async (
        subscriptionId: PricingPlanSubscription['id'],
        country: CountryCode,
    ) => {
        const response = await getPaymentMethodOptions({
            subscriptionId,
            country,
        });

        paymentMethodOptions.value = response;
    };

    return {
        loadPaymentMethodOptions,
        paymentMethodOptions,
    };
};
