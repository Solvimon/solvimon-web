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
     * The request a lookup is waiting on. Held outside a ref because it is a promise to share, not
     * state to render, and cleared once it settles.
     */
    let inFlight:
        | {
              payload: GetPaymentMethodOptionsPayload;
              options: Promise<PaymentMethodOptionsResponse>;
          }
        | undefined;

    /**
     * Callers watch country and amount and ask again on every change, so a payload already looked
     * up is answered from what is held, and one still being looked up is joined. Both are needed:
     * two callers reacting to the same change ask in the same tick, before there is an answer to
     * hold on to.
     */
    const get = async (
        payload: GetPaymentMethodOptionsPayload,
    ): Promise<PaymentMethodOptionsResponse> => {
        if (isEqual(payload, cachedPayload.value)) {
            return data.value;
        }

        if (inFlight && isEqual(payload, inFlight.payload)) {
            return inFlight.options;
        }

        const options = execute(payload).then((response) => {
            cachedPayload.value = payload;
            return response;
        });

        inFlight = { payload, options };

        try {
            return await options;
        } finally {
            if (inFlight?.payload === payload) {
                inFlight = undefined;
            }
        }
    };

    return { paymentMethodOptions: data, get, apiStatus, error, isPending };
}
