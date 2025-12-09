import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/types';
import type { Error } from '@/types/errors';

export interface PaymentIntegrationFormAdyenProps {
    countryCode: string;
    customerId?: Customer['id'];
    invoiceId?: Invoice['id'];
    paymentMethodOptionResponseEntry: PaymentMethodOptionResponseEntry;
    variant: 'TOKENIZE' | 'AUTHORIZE';
    selected: boolean;
    onSelect?: () => void;
    amount: Amount;
    validateOnSubmit?: () => Promise<boolean>;
    context: AuthorizePaymentPayload['context'];
    forceStorePaymentMethod?: boolean;
}

export interface PaymentIntegrationFormAdyenEmits {
    /**
     * Emitted when a payment method is selected.
     */
    (e: 'select'): void;
    /**
     * Emitted when an error occurs.
     */
    (e: 'error', error: Error): void;
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
