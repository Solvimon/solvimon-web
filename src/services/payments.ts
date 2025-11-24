import type {
    AuthorizePaymentPayload,
    Payment,
    PaymentAcceptor,
    PaymentDetailsResponse,
    AuthorizePaymentResponse,
} from '@solvimon/types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

const BASE_URL = '/portal/payments';

export const createPaymentsService = () => {
    const request = createRequestService();
    const config = useConfig();

    /**
     * Get all payments.
     */
    function getPayments(invoiceId: string) {
        return request<Payment>({
            url: `${config.apiUrls.transaction}${BASE_URL}`,
            query: { invoice_id: invoiceId },
            isCollection: true,
        });
    }

    /**
     * Get the payment details.
     */
    function getPaymentDetails({
        paymentAcceptorId,
        paymentGatewayVariant,
        adyen,
    }: {
        paymentAcceptorId: PaymentAcceptor['id'];
        paymentGatewayVariant: 'ADYEN';
        adyen: {
            redirect_result?: string | undefined;
            threeds_result?: string | undefined;
            payment_data?: string | undefined;
        };
    }) {
        return request<PaymentDetailsResponse>({
            url: `${config.apiUrls.transaction}${BASE_URL}/verify-details`,
            options: {
                method: 'POST',
            },
            data: {
                payment_acceptor_id: paymentAcceptorId,
                payment_gateway_variant: paymentGatewayVariant,
                adyen,
            },
        });
    }

    /**
     * Authorize a payment.
     */
    function authorizePayment(data: AuthorizePaymentPayload) {
        return request<AuthorizePaymentResponse>({
            url: `${config.apiUrls.transaction}${BASE_URL}/authorize`,
            options: {
                method: 'POST',
            },
            data,
        });
    }

    return {
        getPayments,
        getPaymentDetails,
        authorizePayment,
    };
};
