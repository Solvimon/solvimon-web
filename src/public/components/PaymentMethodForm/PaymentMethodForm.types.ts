import type {
    Amount,
    CountryCode,
    Customer,
    Invoice,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';

interface PaymentMethodFormBaseConfiguration {
    /**
     * The customer's two-letter country, which decides the payment methods on offer. Defaults to the
     * country of the customer's address.
     */
    countryCode?: CountryCode;
    /**
     * Where the customer goes once the form is through. Given one, the completed form offers a
     * button rather than leaving on its own: an instant redirect takes away the confirmation the
     * customer just earned, and a delayed one races whoever reads faster.
     */
    successRedirectUrl?: string;
    /** Label for that button, for a host whose own wording says where it leads. */
    successRedirectLabel?: string;
}

/** Saves a payment method for later, without charging it. The default. */
export interface PaymentMethodFormSetupConfiguration extends PaymentMethodFormBaseConfiguration {
    mode?: 'setup';
    /** The invoice the method is saved for, so the methods on offer are the ones it can be paid with. */
    invoiceId?: Invoice['id'];
    /** An amount to offer the methods for, when there is no invoice. */
    amount?: Amount;
}

/** Pays an invoice, and lets the customer save the method while doing so. */
export interface PaymentMethodFormPaymentConfiguration extends PaymentMethodFormBaseConfiguration {
    mode: 'payment';
    invoiceId: Invoice['id'];
    /** The amount to charge, in the invoice's currency. */
    amount: Amount;
}

export type PaymentMethodFormConfiguration =
    | PaymentMethodFormSetupConfiguration
    | PaymentMethodFormPaymentConfiguration;

export interface PaymentMethodFormProps {
    customer: Customer;
    paymentMethodOptions: PaymentMethodOptionsResponse;
    configuration?: PaymentMethodFormConfiguration;
    isLoading?: boolean;
    title?: string;
    /**
     * Hides the form's own submit button, for hosts that submit it from their own chrome — a modal
     * footer, say. Pair it with the exposed `submit()` and `isPaymentPending`.
     */
    hideSubmitButton?: boolean;
}

export interface PaymentMethodFormEmits {
    /** The form completed: the method was stored, or the payment authorized. */
    (e: 'success'): void;
    (e: 'failure', error: unknown): void;
}
