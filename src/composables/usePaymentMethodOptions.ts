import type {
    Amount,
    CountryCode,
    PaymentMethodOptionsResponse,
    PricingPlanSubscription,
} from '@solvimon/types';
import { ref } from 'vue';
import { createPaymentMethodsService } from '@/services/paymentMethods';

export const usePaymentMethodOptions = () => {
    const paymentMethodOptions = ref<PaymentMethodOptionsResponse>([]);

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
        const response = await getPaymentMethodOptions({
            subscriptionId,
            country,
            amount,
        });

        paymentMethodOptions.value = response;
    };

    return {
        loadPaymentMethodOptions,
        paymentMethodOptions,
    };
};
