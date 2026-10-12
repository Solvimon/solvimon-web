import { ApiStatus, type PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
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
                  subscriptionId: payload.subscriptionId,
                  invoiceId: payload.invoiceId,
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
    /** What the caller asked for last; only its failure is still the caller's to show. */
    let latestPayload: GetPaymentMethodOptionsPayload | undefined;

    /** The held options answer the payload, so a failure for another one no longer applies. */
    function settleOnHeldOptions() {
        error.value = null;
        apiStatus.value = ApiStatus.Done;
    }

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
        latestPayload = payload;

        if (isEqual(payload, cachedPayload.value)) {
            settleOnHeldOptions();
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
        } catch (failure) {
            // The caller has moved on to options that are held; this failure is not theirs to see.
            if (latestPayload !== payload && isEqual(latestPayload, cachedPayload.value)) {
                settleOnHeldOptions();
            }
            throw failure;
        } finally {
            if (inFlight?.payload === payload) {
                inFlight = undefined;
            }
        }
    };

    return { paymentMethodOptions: data, get, apiStatus, error, isPending };
}
