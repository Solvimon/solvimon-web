import type {
    Address,
    Amount,
    AuthorizePaymentPayload,
    Invoice,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { ExpressPaymentMethodProps } from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethod.types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

export interface ExpressPaymentMethodsProps {
    amount: Amount;
    countryCode: string;
    locale: string;
    /**
     * Express payment methods. The `undefined` value will show a loading state.
     * The `null` value will show an empty state.
     */
    paymentMethodsOptionsResponse: PaymentMethodOptionsResponse | undefined;
    billingInformation: ExpressPaymentMethodProps['billingInformation'];
    onBillingInformationChange: (state: Partial<CheckoutFormState>) => Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }>;
    /** What an express payment is for, so the charge creates the subscription it is paying for. */
    context?: AuthorizePaymentPayload['context'];
    /** Checked before an express authorization is allowed to become a charge. */
    validateOnSubmit?: () => Promise<boolean>;
}

export interface ExpressPaymentMethodsEmits {
    (e: 'update-billing-information', billingInformation: Partial<Address>): void;
    (e: 'payment-success'): void;
    (e: 'payment-failed', error: Error): void;
}
