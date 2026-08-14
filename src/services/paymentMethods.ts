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
    ArchivePaymentMethodPayload,
    GetPaymentMethodOptionsByCustomerIdPayload,
    GetPaymentMethodOptionsBySubscriptionIdPayload,
    GetPaymentMethodOptionsPayload,
    GetPaymentMethodsPayload,
    SetDefaultPaymentMethodPayload,
} from './paymentMethods.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export function createPaymentMethodsService() {
    const request = createRequestService();
    const config = useConfig();
    const BASE_URL = '/portal/payment-methods';

    function setDefaultPaymentMethod({
        paymentMethodId,
    }: SetDefaultPaymentMethodPayload): Promise<PaymentMethod> {
        return request<PaymentMethod>({
            url: `${config.apiUrls.config}${BASE_URL}/${paymentMethodId}`,
            options: { method: 'PATCH' },
            data: { is_default: true },
        });
    }

    /**
     * Deleting a payment method archives it: the API has no DELETE, and the record has to survive
     * for the invoices already paid with it.
     */
    function archivePaymentMethod({
        paymentMethodId,
    }: ArchivePaymentMethodPayload): Promise<PaymentMethod> {
        return request<PaymentMethod>({
            url: `${config.apiUrls.config}${BASE_URL}/${paymentMethodId}`,
            options: { method: 'PATCH' },
            data: { status: 'ARCHIVED' },
        });
    }

    async function getPaymentMethods({
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

        const response = await request<PaymentMethod>({
            url: url.toString(),
            isCollection: true,
        });

        // Archived methods are deleted as far as the customer is concerned. The endpoint takes no
        // status filter, so they are dropped here — the one place every read goes through.
        return {
            ...response,
            data: (response.data ?? []).filter(({ status }) => status !== 'ARCHIVED'),
        };
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
        archivePaymentMethod,
        getPaymentMethods,
        getPaymentMethodOptions,
        tokenizePaymentMethod,
        setDefaultPaymentMethod,
    };
}
