import type {
    Amount,
    AuthorizePaymentPayload,
    CountryCode,
    Customer,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { PaymentIntegrationFormProps } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

interface PaymentMethodFormBaseConfiguration {
    invoiceId?: PaymentIntegrationFormProps['invoiceId'];
    amount?: Amount;
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

export interface TokenizePaymentMethodFormConfiguration extends PaymentMethodFormBaseConfiguration {
    variant?: 'TOKENIZE';
}

export interface AuthorizePaymentMethodFormConfiguration extends Omit<
    PaymentMethodFormBaseConfiguration,
    'amount'
> {
    variant: 'AUTHORIZE';
    amount: Amount;
    context: Exclude<AuthorizePaymentPayload['context'], undefined>;
}

export type PaymentMethodFormConfiguration =
    | TokenizePaymentMethodFormConfiguration
    | AuthorizePaymentMethodFormConfiguration;

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
