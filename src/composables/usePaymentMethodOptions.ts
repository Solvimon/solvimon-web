import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
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

    const { data, execute: get, apiStatus, error, isPending } = useService({
        initialValue: [] as PaymentMethodOptionsResponse,
        service,
    });

    return { paymentMethodOptions: data, get, apiStatus, error, isPending };
}
