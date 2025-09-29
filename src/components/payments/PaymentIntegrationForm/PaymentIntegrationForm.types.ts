import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentMethodOptionsResponse,
} from '@solvimon/types';
import type { Error } from '@/types/errors';

interface BasePaymentIntegrationFormProps {
    paymentMethodOptions: PaymentMethodOptionsResponse;
    countryCode: string;
    invoiceId?: Invoice['id'];
    variant: 'AUTHORIZE' | 'TOKENIZE';
    amount: Amount;
    redirectUrl: string;
    selectedOption?: string;
    validateOnSubmit?: () => Promise<boolean>;
    context?: AuthorizePaymentPayload['context'];
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
    (e: 'select', value: 'PAYMENT_GATEWAY_ADYEN' | 'PAYMENT_GATEWAY_STRIPE'): void;
    (e: 'error', error: Error): void;
    (e: 'payment-failed', error: Error): void;
    (e: 'payment-success'): void;
}
