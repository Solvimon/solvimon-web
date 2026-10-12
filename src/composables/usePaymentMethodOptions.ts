import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import { isEqual } from '@solvimon/solvimon-ui';
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
    const request = (payload: GetPaymentMethodOptionsPayload) =>
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

    /** The last lookup that succeeded. Only successes are held, so a failed payload is asked again. */
    let held:
        | { payload: GetPaymentMethodOptionsPayload; options: PaymentMethodOptionsResponse }
        | undefined;

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
     * Joining goes through `execute` like any other lookup, so a payload asked again after the
     * caller left it is once more the one whose answer is shown.
     */
    const service = (payload: GetPaymentMethodOptionsPayload) => {
        if (inFlight && isEqual(payload, inFlight.payload)) {
            return inFlight.options;
        }

        const options = request(payload).then((response) => {
            held = { payload, options: response };
            return response;
        });
        const clear = () => {
            if (inFlight?.options === options) {
                inFlight = undefined;
            }
        };
        options.then(clear, clear);
        inFlight = { payload, options };
        return options;
    };

    const initialValue: PaymentMethodOptionsResponse = [];
    const { data, execute, settle, apiStatus, error, isPending } = useService({
        initialValue,
        service,
    });

    /**
     * Callers watch country and amount and ask again on every change, so a payload already looked
     * up is answered from what is held, and one still being looked up is joined. Both are needed:
     * two callers reacting to the same change ask in the same tick, before there is an answer to
     * hold on to. Whatever answers last, what is shown is the answer to the payload asked last.
     */
    const get = async (
        payload: GetPaymentMethodOptionsPayload,
    ): Promise<PaymentMethodOptionsResponse> => {
        if (held && isEqual(payload, held.payload)) {
            settle(held.options);
            return held.options;
        }

        return execute(payload);
    };

    return { paymentMethodOptions: data, get, apiStatus, error, isPending };
}
