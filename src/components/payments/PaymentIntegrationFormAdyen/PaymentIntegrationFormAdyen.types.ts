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
}

export interface PaymentIntegrationFormAdyenEmits {
    (e: 'select'): void;
    (e: 'error', error: Error): void;
    (e: 'payment-failed', error: Error): void;
    (e: 'payment-success'): void;
}
