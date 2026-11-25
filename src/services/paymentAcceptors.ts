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

/** Without a reference, the portal generates one (`bank_account_` and 16 random characters). */
export type PaymentAcceptorCreatePayload = Omit<PaymentAcceptorPayload, 'reference'> & {
    reference?: PaymentAcceptorPayload['reference'];
};

export interface PaymentAcceptorsService {
    getPaymentAcceptors(args: {
        customerId: Customer['id'];
    }): Promise<ApiSuccessCollectionResponse<PaymentAcceptor>>;
    createPaymentAcceptor(payload: PaymentAcceptorCreatePayload): Promise<PaymentAcceptor>;
    updatePaymentAcceptor(args: {
        paymentAcceptorId: PaymentAcceptor['id'];
        payload: PaymentAcceptorPatchPayload;
    }): Promise<PaymentAcceptor>;
    archivePaymentAcceptor(args: {
        paymentAcceptorId: PaymentAcceptor['id'];
    }): Promise<PaymentAcceptor>;
}

export function createPaymentAcceptorsService(): PaymentAcceptorsService {
    const request = createRequestService();
    const config = useConfig();
    const BASE_PATH = ['portal', 'payment-acceptors'];

    /**
     * GET /v1/portal/payment-acceptors — the customer's acceptors except archived ones, which the
     * customer deleted. The portal does not page this list.
     */
    async function getPaymentAcceptors({
        customerId,
    }: {
        customerId: Customer['id'];
    }): Promise<ApiSuccessCollectionResponse<PaymentAcceptor>> {
        const response = await request<PaymentAcceptor>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            query: { customer_id: customerId },
            isCollection: true,
        });

        return {
            ...response,
            data: (response.data ?? []).filter(({ status }) => status === 'ACTIVE'),
        };
    }

    /** POST /v1/portal/payment-acceptors — only a self-billing customer may, and only a bank account. */
    function createPaymentAcceptor(
        payload: PaymentAcceptorCreatePayload,
    ): Promise<PaymentAcceptor> {
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

    /**
     * PATCH /v1/portal/payment-acceptors/{id} with `status: ARCHIVED` — what deleting one does. The
     * API refuses a real delete once an invoice has used the acceptor, and an archived one is no
     * longer offered to the payer.
     */
    function archivePaymentAcceptor({
        paymentAcceptorId,
    }: {
        paymentAcceptorId: PaymentAcceptor['id'];
    }): Promise<PaymentAcceptor> {
        return request<PaymentAcceptor>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, paymentAcceptorId),
            data: { status: 'ARCHIVED' },
            options: { method: 'PATCH' },
        });
    }

    return {
        getPaymentAcceptors,
        createPaymentAcceptor,
        updatePaymentAcceptor,
        archivePaymentAcceptor,
    };
}
