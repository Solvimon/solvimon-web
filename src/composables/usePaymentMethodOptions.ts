import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import { isEqual } from '@solvimon/solvimon-ui';
import { ref } from 'vue';
import { useService } from './useService';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import type {
    GetPaymentMethodOptionsByCustomerIdPayload,
    GetPaymentMethodOptionsPayload,
} from '@/services/paymentMethods.types';

function hasCustomerId(
    payload: GetPaymentMethodOptionsPayload,
): payload is GetPaymentMethodOptionsByCustomerIdPayload {
    return payload.customerId !== undefined;
}

export function usePaymentMethodOptions() {
    const { getPaymentMethodOptions } = createPaymentMethodsService();
    const service = (payload: GetPaymentMethodOptionsPayload) =>
        hasCustomerId(payload)
            ? getPaymentMethodOptions({
                  customerId: payload.customerId,
                  amount: payload.amount,
                  country: payload.country,
              })
            : getPaymentMethodOptions({
                  subscriptionId: payload.subscriptionId,
                  amount: payload.amount,
                  country: payload.country,
              });

    const initialValue: PaymentMethodOptionsResponse = [];
    const { data, execute, apiStatus, error, isPending } = useService({
        initialValue,
        service,
    });

    const cachedPayload = ref<GetPaymentMethodOptionsPayload>();

    /**
     * Callers watch country and amount and ask again on every change, so a payload already looked
     * up is answered from what is held rather than re-requested.
     */
    const get = async (
        payload: GetPaymentMethodOptionsPayload,
    ): Promise<PaymentMethodOptionsResponse> => {
        if (isEqual(payload, cachedPayload.value)) {
            return data.value;
        }

        const options = await execute(payload);

        cachedPayload.value = payload;

        return options;
    };

    return { paymentMethodOptions: data, get, apiStatus, error, isPending };
}
