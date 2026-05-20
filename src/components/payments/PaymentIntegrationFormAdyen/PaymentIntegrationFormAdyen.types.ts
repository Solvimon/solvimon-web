import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/solvimon-types';
import type { Error } from '@/types/errors';

export interface PaymentIntegrationFormAdyenProps {
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

export interface PaymentIntegrationFormAdyenEmits {
    /**
     * Emitted when a payment method is selected.
     */
    (e: 'select', payload: { paymentMethodType: string }): void;
    /**
     * Emitted when a payment fails.
     */
    (e: 'payment-failed', error: Error): void;
    /**
     * Emitted when a payment is successful.
     */
    (e: 'payment-success'): void;
    /**
     * Emitted when the payment integration form is ready and the Adyen SDK is initialized.
     */
    (e: 'ready'): void;
}
