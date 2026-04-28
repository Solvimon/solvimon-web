import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { Error } from '@/types/errors';

interface BasePaymentIntegrationFormProps {
    paymentMethodOptions: PaymentMethodOptionsResponse;
    countryCode: string;
    invoiceId?: Invoice['id'];
    variant: 'AUTHORIZE' | 'TOKENIZE';
    amount: Amount;
    successRedirectUrl?: string;
    selectedOption?: string;
    validateOnSubmit?: () => Promise<boolean>;
    context?: AuthorizePaymentPayload['context'];
    forceStorePaymentMethod?: boolean;
}

export interface AuthorizePaymentIntegrationFormProps extends BasePaymentIntegrationFormProps {
    customerId?: Customer['id'];
    variant: 'AUTHORIZE';
    context: AuthorizePaymentPayload['context'];
}

export interface TokenizePaymentIntegrationFormProps extends BasePaymentIntegrationFormProps {
    customerId: Customer['id'];
    variant: 'TOKENIZE';
}

export type PaymentIntegrationFormProps =
    | AuthorizePaymentIntegrationFormProps
    | TokenizePaymentIntegrationFormProps;

export interface PaymentIntegrationFormEmits {
    /**
     * Emitted when a payment method is selected.
     */
    (e: 'select', value: 'PAYMENT_GATEWAY_ADYEN' | 'PAYMENT_GATEWAY_STRIPE'): void;
    /**
     * Emitted when a payment fails.
     */
    (e: 'payment-failed', error: Error): void;
    /**
     * Emitted when a payment is successful.
     */
    (e: 'payment-success'): void;
    /**
     * Emitted when the payment integration form is ready and the payment integration form is initialized.
     */
    (e: 'ready'): void;
}
