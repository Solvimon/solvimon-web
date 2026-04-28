import {
    type Amount,
    type CountryCode,
    type PaymentMethodOptionsResponse,
    type PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { ref } from 'vue';
import { isEqual } from 'lodash';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import type { GetPaymentMethodOptionsPayload } from '@/services/paymentMethods.types';
import { useService } from '@/composables/useService';

export const usePaymentMethodOptions = () => {
    const cachedPayload = ref<GetPaymentMethodOptionsPayload>();
    const { getPaymentMethodOptions } = createPaymentMethodsService();
    const { data: paymentMethodOptions, execute, isPending } = useService({
        initialValue: [] as PaymentMethodOptionsResponse,
        service: getPaymentMethodOptions,
    });

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
        await execute(payload);
    };

    return {
        loadPaymentMethodOptions,
        paymentMethodOptions,
        isPending,
    };
};
