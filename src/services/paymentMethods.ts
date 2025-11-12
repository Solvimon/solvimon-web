import type {
    ApiSuccessCollectionResponse,
    Customer,
    PaymentMethod,
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
import { withPagination } from '@solvimon/ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

interface PaymentMethodsService {
    getPaymentMethods(args: {
        customerId: Customer['id'];
        pagination: {
            page?: number;
            pageSize?: number;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        };
        query?: Record<string, string | number | null | undefined>;
    }): Promise<ApiSuccessCollectionResponse<PaymentMethod>>;
    getPaymentMethodOptions(args: {
        customerId: Customer['id'];
        country?: string;
    }): Promise<PaymentMethodOptionsResponse>;
    getPaymentMethodOptions(args: {
        subscriptionId: PricingPlanSubscription['id'];
        country?: string;
    }): Promise<PaymentMethodOptionsResponse>;
    tokenizePaymentMethod(
        data: PaymentMethodTokenizeAdyenPayload,
    ): Promise<
        | PaymentMethodTokenizeSuccessResponse
        | PaymentMethodTokenizeFailedResponse
        | PaymentMethodTokenizeActionRequiredAdyenResponse
    >;
    tokenizePaymentMethod(
        data: PaymentMethodTokenizeStripePayload,
    ): Promise<
        | PaymentMethodTokenizeSuccessResponse
        | PaymentMethodTokenizeFailedResponse
        | PaymentMethodTokenizeActionRequiredStripeResponse
    >;
    tokenizePaymentMethod(
        data: PaymentMethodTokenizePayload,
    ): Promise<PaymentMethodTokenizeResponse>;
}

export function createPaymentMethodsService(): PaymentMethodsService {
    const request = createRequestService();
    const config = useConfig();
    const BASE_URL = '/portal/payment-methods';

    function getPaymentMethods({
        customerId,
        pagination,
        query,
    }: {
        customerId: Customer['id'];
        pagination: {
            page?: number;
            pageSize?: number;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        };
        query?: Record<string, string | number | null | undefined>;
    }): Promise<ApiSuccessCollectionResponse<PaymentMethod>> {
        const queryParams = withPagination(
            {
                customer_id: customerId,
                ...(query ?? {}),
            },
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
        data: PaymentMethodTokenizeAdyenPayload,
    ): Promise<
        | PaymentMethodTokenizeSuccessResponse
        | PaymentMethodTokenizeFailedResponse
        | PaymentMethodTokenizeActionRequiredAdyenResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizeStripePayload,
    ): Promise<
        | PaymentMethodTokenizeSuccessResponse
        | PaymentMethodTokenizeFailedResponse
        | PaymentMethodTokenizeActionRequiredStripeResponse
    >;
    function tokenizePaymentMethod(
        data: PaymentMethodTokenizePayload,
    ): Promise<PaymentMethodTokenizeResponse> {
        return request<PaymentMethodTokenizeActionRequiredResponse>({
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
