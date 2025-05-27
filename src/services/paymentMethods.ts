import type {
    Customer,
    PaymentMethodOptionsResponse,
    PaymentMethodTokenizeActionRequiredAdyenResponse,
    PaymentMethodTokenizeActionRequiredResponse,
    PaymentMethodTokenizeActionRequiredStripeResponse,
    PaymentMethodTokenizeAdyenPayload,
    PaymentMethodTokenizeFailedResponse,
    PaymentMethodTokenizePayload,
    PaymentMethodTokenizeResponse,
    PaymentMethodTokenizeStripePayload,
    PaymentMethodTokenizeSuccessResponse,
    PricingPlanSubscription,
} from '@solvimon/types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/ConfigProvider/composables/useConfig';

export function createPaymentMethodsService() {
    const request = createRequestService();
    const config = useConfig();

    /**
     * Fetch payment method options for a resource.
     */
    function getPaymentMethodOptions(params: {
        customerId: Customer['id'];
        country?: string;
    }): Promise<PaymentMethodOptionsResponse>;
    function getPaymentMethodOptions(params: {
        subscriptionId: PricingPlanSubscription['id'];
        country?: string;
    }): Promise<PaymentMethodOptionsResponse>;
    function getPaymentMethodOptions({
        customerId,
        country,
        subscriptionId,
    }: {
        customerId?: Customer['id'];
        country?: string;
        subscriptionId?: PricingPlanSubscription['id'];
    }): Promise<PaymentMethodOptionsResponse> {
        return request<PaymentMethodOptionsResponse>({
            url: `${config.apiUrls.config}/portal/payment-method-options`,
            options: { method: 'POST' },
            data: {
                ...(customerId ? { customer_id: customerId } : {}),
                ...(country ? { country } : {}),
                ...(subscriptionId ? { pricing_plan_subscription_id: subscriptionId } : {}),
            },
        });
    }

    /**
     * Tokenize the payment method.
     */
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeAdyenPayload
    ): Promise<
        | PaymentMethodTokenizeSuccessResponse
        | PaymentMethodTokenizeFailedResponse
        | PaymentMethodTokenizeActionRequiredAdyenResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeStripePayload
    ): Promise<
        | PaymentMethodTokenizeSuccessResponse
        | PaymentMethodTokenizeFailedResponse
        | PaymentMethodTokenizeActionRequiredStripeResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizePayload
    ): Promise<PaymentMethodTokenizeResponse> {
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
