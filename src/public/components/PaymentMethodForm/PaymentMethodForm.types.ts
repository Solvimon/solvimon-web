import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { PaymentIntegrationFormProps } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

interface PaymentMethodFormBaseConfiguration {
    invoiceId?: PaymentIntegrationFormProps['invoiceId'];
    amount?: Amount;
    selectedOption?: string;
    successRedirectUrl?: string;
    validateOnSubmit?: PaymentIntegrationFormProps['validateOnSubmit'];
    forceStorePaymentMethod?: PaymentIntegrationFormProps['forceStorePaymentMethod'];
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
    countryCode?: string;
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
