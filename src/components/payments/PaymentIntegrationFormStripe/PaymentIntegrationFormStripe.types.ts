import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentGatewayVariant,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/solvimon-types';
import type { Error } from '@/types/errors';

export interface PaymentIntegrationFormStripeProps {
    countryCode: string;
    customerId?: Customer['id'];
    invoiceId?: Invoice['id'];
    paymentMethodOptionResponseEntry: PaymentMethodOptionResponseEntry;
    variant: 'TOKENIZE' | 'AUTHORIZE';
    selected: boolean;
    amount: Amount;
    validateOnSubmit?: () => Promise<boolean>;
    context: AuthorizePaymentPayload['context'];
    forceStorePaymentMethod?: boolean;
}

export interface PaymentIntegrationFormStripeEmits {
    (
        e: 'select',
        payload: { paymentMethodType: string; paymentGatewayVariant: PaymentGatewayVariant },
    ): void;
    (e: 'payment-failed', error: Error): void;
    (e: 'payment-success'): void;
    (e: 'ready'): void;
}
