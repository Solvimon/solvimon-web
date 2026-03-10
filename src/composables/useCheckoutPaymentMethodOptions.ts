import {
    ApiStatus,
    type Amount,
    type CountryCode,
    type PaymentMethodOptionsResponse,
    type PricingPlanSubscription,
} from '@solvimon/types';
import { computed, ref } from 'vue';
import { isEqual } from 'lodash';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import type { GetPaymentMethodOptionsPayload } from '@/services/paymentMethods.types';

export const usePaymentMethodOptions = () => {
    const paymentMethodOptions = ref<PaymentMethodOptionsResponse>([]);
    const apiStatus = ref<ApiStatus>(ApiStatus.Initial);
    const cachedPayload = ref<GetPaymentMethodOptionsPayload>();

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
        const payload: GetPaymentMethodOptionsPayload = {
            subscriptionId,
            country,
            amount,
        };

        if (isEqual(payload, cachedPayload.value)) {
            return;
        }

        cachedPayload.value = payload;

        try {
            apiStatus.value = ApiStatus.Loading;
            const response = await getPaymentMethodOptions({
                subscriptionId,
                country,
                amount,
            });

            /**
             * If the response is the same as the current payment method options,
             * don't overwrite the ref value to avoid unnecessary re-renders.
             */
            if (isEqual(response, paymentMethodOptions.value)) return;

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
