import type {
    AuthorizePaymentPayload,
    Payment,
    PaymentAcceptor,
    PaymentDetailsResponse,
    AuthorizePaymentResponse,
} from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type { PaymentAuthorizationContext } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

const BASE_PATH = ['portal', 'payments'];

type AuthorizePaymentRequestPayload = Omit<AuthorizePaymentPayload, 'context'> & {
    context?: PaymentAuthorizationContext;
};

export const createPaymentsService = () => {
    const request = createRequestService();
    const config = useConfig();

    /**
     * Get all payments.
     */
    function getPayments(invoiceId: string) {
        return request<Payment>({
            url: buildUrl(config.apiUrls.transaction, ...BASE_PATH),
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
            details?: Record<string, unknown>;
            redirect_result?: string | undefined;
            threeds_result?: string | undefined;
            payment_data?: string | undefined;
        };
    }) {
        return request<PaymentDetailsResponse>({
            url: buildUrl(config.apiUrls.transaction, ...BASE_PATH, 'verify-details'),
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
    function authorizePayment(data: AuthorizePaymentRequestPayload) {
        return request<AuthorizePaymentResponse>({
            url: buildUrl(config.apiUrls.transaction, ...BASE_PATH, 'authorize'),
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
