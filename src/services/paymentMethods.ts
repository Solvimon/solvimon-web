import type {
    ApiSuccessCollectionResponse,
    AuthorizePaymentActionRequiredResponse,
    AuthorizePaymentFailureResponse,
    AuthorizePaymentResponse,
    AuthorizePaymentSuccessResponse,
    PaymentMethod,
    PaymentMethodOptionsResponse,
    PaymentMethodTokenizeAdyenPayload,
    PaymentMethodTokenizePayload,
    PaymentMethodTokenizeStripePayload,
} from '@solvimon/solvimon-types';
import { withPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import type {
    GetPaymentMethodOptionsByCustomerIdPayload,
    GetPaymentMethodOptionsBySubscriptionIdPayload,
    GetPaymentMethodOptionsPayload,
    GetPaymentMethodsPayload,
} from './paymentMethods.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createPaymentMethodsService() {
    const request = createRequestService();
    const config = useConfig();
    const BASE_URL = '/portal/payment-methods';

    function getPaymentMethods({
        customerId,
        pagination,
        query,
    }: GetPaymentMethodsPayload): Promise<ApiSuccessCollectionResponse<PaymentMethod>> {
        const queryParams = withPagination(
            { customer_id: customerId, ...(query ?? {}) },
            pagination,
        );

        const url = new URL(`${config.apiUrls.config}${BASE_URL}`);

        Object.entries(queryParams).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    url.searchParams.append(`${key}[]`, `${entry}`);
                });
                return;
            }

            url.searchParams.append(key, `${value}`);
        });

        return request<PaymentMethod>({
            url: url.toString(),
            isCollection: true,
        });
    }

    /**
     * Fetch payment method options for a resource.
     */
    function getPaymentMethodOptions(
        params: GetPaymentMethodOptionsByCustomerIdPayload,
    ): Promise<PaymentMethodOptionsResponse>;
    function getPaymentMethodOptions(
        params: GetPaymentMethodOptionsBySubscriptionIdPayload,
    ): Promise<PaymentMethodOptionsResponse>;
    function getPaymentMethodOptions({
        customerId,
        country,
        subscriptionId,
        amount,
    }: GetPaymentMethodOptionsPayload): Promise<PaymentMethodOptionsResponse> {
        return request<PaymentMethodOptionsResponse>({
            url: `${config.apiUrls.config}/portal/payment-method-options`,
            options: { method: 'POST' },
            data: {
                ...(customerId && { customer_id: customerId }),
                ...(country && { country }),
                ...(subscriptionId && { pricing_plan_subscription_id: subscriptionId }),
                amount,
            },
        });
    }

    /**
     * Tokenize the payment method.
     */
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeAdyenPayload,
    ): Promise<
        | AuthorizePaymentSuccessResponse
        | AuthorizePaymentFailureResponse
        | AuthorizePaymentActionRequiredResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeStripePayload,
    ): Promise<
        | AuthorizePaymentSuccessResponse
        | AuthorizePaymentFailureResponse
        | AuthorizePaymentActionRequiredResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizePayload,
    ): Promise<AuthorizePaymentResponse> {
        return request<AuthorizePaymentActionRequiredResponse>({
            url: `${config.apiUrls.config}/portal/payment-methods/tokenize`,
            options: { method: 'POST' },
            data,
        });
    }

    return {
        getPaymentMethods,
        getPaymentMethodOptions,
        tokenizePaymentMethod,
    };
}
