import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    Payment,
    PaymentAcceptor,
    PaymentMethod,
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

export interface ChargeStoredPaymentMethodPayload {
    paymentAcceptorId: PaymentAcceptor['id'];
    customerId: Customer['id'];
    paymentMethodId: PaymentMethod['id'];
    invoiceId: Invoice['id'];
    amount: Amount;
}

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
        const { amount: _amount, ...withoutAmount } = data;
        return request<AuthorizePaymentResponse>({
            url: buildUrl(config.apiUrls.transaction, ...BASE_PATH, 'authorize'),
            options: {
                method: 'POST',
            },
            // A checkout session charges its own previewed total and refuses an amount sent along.
            data: data.context?.type === 'CHECKOUT_SESSION' ? withoutAmount : data,
        });
    }

    /**
     * The API charges the stored method itself, without the customer at a gateway form, so it takes
     * no gateway payload and refuses a return URL; a charge the gateway declines answers 400.
     */
    function chargeStoredPaymentMethod({
        paymentAcceptorId,
        customerId,
        paymentMethodId,
        invoiceId,
        amount,
    }: ChargeStoredPaymentMethodPayload) {
        return request<AuthorizePaymentResponse>({
            url: buildUrl(config.apiUrls.transaction, ...BASE_PATH, 'authorize'),
            options: { method: 'POST' },
            data: {
                payment_acceptor_id: paymentAcceptorId,
                customer_id: customerId,
                payment_method_id: paymentMethodId,
                amount,
                context: {
                    type: 'INVOICE',
                    related_resource_ids: [{ type: 'INVOICE', id: invoiceId }],
                },
            },
        });
    }

    return {
        getPayments,
        getPaymentDetails,
        authorizePayment,
        chargeStoredPaymentMethod,
    };
};
