import type {
    ApiSuccessCollectionResponse,
    Customer,
    PaymentAcceptor,
    PaymentAcceptorPatchPayload,
    PaymentAcceptorPayload,
} from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export interface PaymentAcceptorsService {
    getPaymentAcceptors(args: {
        customerId: Customer['id'];
    }): Promise<ApiSuccessCollectionResponse<PaymentAcceptor>>;
    createPaymentAcceptor(payload: PaymentAcceptorPayload): Promise<PaymentAcceptor>;
    updatePaymentAcceptor(args: {
        paymentAcceptorId: PaymentAcceptor['id'];
        payload: PaymentAcceptorPatchPayload;
    }): Promise<PaymentAcceptor>;
    deletePaymentAcceptor(args: {
        paymentAcceptorId: PaymentAcceptor['id'];
    }): Promise<PaymentAcceptor>;
}

export function createPaymentAcceptorsService(): PaymentAcceptorsService {
    const request = createRequestService();
    const config = useConfig();
    const BASE_PATH = ['portal', 'payment-acceptors'];

    /**
     * GET /v1/portal/payment-acceptors — every acceptor of the customer, whatever its status. The
     * portal does not page this list.
     */
    function getPaymentAcceptors({
        customerId,
    }: {
        customerId: Customer['id'];
    }): Promise<ApiSuccessCollectionResponse<PaymentAcceptor>> {
        return request<PaymentAcceptor>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            query: { customer_id: customerId },
            isCollection: true,
        });
    }

    /** POST /v1/portal/payment-acceptors — only a self-billing customer may, and only a bank account. */
    function createPaymentAcceptor(payload: PaymentAcceptorPayload): Promise<PaymentAcceptor> {
        return request<PaymentAcceptor>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            data: payload,
            options: { method: 'POST' },
        });
    }

    /** PATCH /v1/portal/payment-acceptors/{id} */
    function updatePaymentAcceptor({
        paymentAcceptorId,
        payload,
    }: {
        paymentAcceptorId: PaymentAcceptor['id'];
        payload: PaymentAcceptorPatchPayload;
    }): Promise<PaymentAcceptor> {
        return request<PaymentAcceptor>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, paymentAcceptorId),
            data: payload,
            options: { method: 'PATCH' },
        });
    }

    /** DELETE /v1/portal/payment-acceptors/{id} */
    function deletePaymentAcceptor({
        paymentAcceptorId,
    }: {
        paymentAcceptorId: PaymentAcceptor['id'];
    }): Promise<PaymentAcceptor> {
        return request<PaymentAcceptor>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, paymentAcceptorId),
            options: { method: 'DELETE' },
        });
    }

    return {
        getPaymentAcceptors,
        createPaymentAcceptor,
        updatePaymentAcceptor,
        deletePaymentAcceptor,
    };
}
