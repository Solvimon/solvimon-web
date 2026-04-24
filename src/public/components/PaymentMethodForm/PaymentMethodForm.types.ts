import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    PaymentMethodOptionsResponse,
} from '@solvimon/types';
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

export interface AuthorizePaymentMethodFormConfiguration
    extends Omit<PaymentMethodFormBaseConfiguration, 'amount'> {
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
}
