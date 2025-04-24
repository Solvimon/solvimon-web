import type {
    PaymentMethodOptionsResponse,
    PaymentMethodTokenizeActionRequiredAdyenResponse,
    PaymentMethodTokenizeActionRequiredResponse,
    PaymentMethodTokenizeActionRequiredStripeResponse,
    PaymentMethodTokenizeAdyenPayload,
    PaymentMethodTokenizePayload,
    PaymentMethodTokenizeStripePayload,
    PaymentMethodTokenizeSuccessResponse,
} from '@solvimon/types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';

export function createPaymentMethodsService() {
    const request = createRequestService();
    const config = useConfig();

    function getPaymentMethodOptions({ customerId }: { customerId: string }) {
        return request<PaymentMethodOptionsResponse>({
            url: `${config.apiUrls.config}/portal/payment-method-options?customer_id=${customerId}`,
        });
    }

    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeAdyenPayload
    ): Promise<
        PaymentMethodTokenizeSuccessResponse | PaymentMethodTokenizeActionRequiredAdyenResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeStripePayload
    ): Promise<
        PaymentMethodTokenizeSuccessResponse | PaymentMethodTokenizeActionRequiredStripeResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizePayload
    ): Promise<PaymentMethodTokenizeSuccessResponse | PaymentMethodTokenizeActionRequiredResponse> {
        return request<PaymentMethodTokenizeActionRequiredResponse>({
            url: `${config.apiUrls.config}/portal/payment-methods/tokenize`,
            options: { method: 'POST' },
            data,
        });
    }

    return {
        getPaymentMethodOptions,
        tokenizePaymentMethod,
    };
}
