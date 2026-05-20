import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentGatewayVariant,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { Error } from '@/types/errors';

interface BasePaymentIntegrationFormProps {
    paymentMethodOptions: PaymentMethodOptionsResponse;
    countryCode: string;
    invoiceId?: Invoice['id'];
    variant: 'AUTHORIZE' | 'TOKENIZE';
    amount: Amount;
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

export type SelectedPaymentMethod = {
    paymentGatewayVariant: PaymentGatewayVariant;
    paymentMethodType: string;
};

export interface PaymentIntegrationFormEmits {
    /**
     * Emitted when a payment method is selected.
     */
    (e: 'select', payload: SelectedPaymentMethod): void;
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
