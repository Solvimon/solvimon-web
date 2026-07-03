import type {
    Amount,
    AuthorizePaymentPayload,
    Customer,
    Invoice,
    PaymentGatewayVariant,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { Error } from '@/types/errors';

export interface ChargeOnDemandAuthorizationContext {
    type: 'CHARGE_ON_DEMAND';
    charge_on_demand: {
        pricing_plan_schedule_id: string;
        pricing_items: Array<{ pricing_item_id: string }>;
    };
}

export type PaymentAuthorizationContext =
    | AuthorizePaymentPayload['context']
    | ChargeOnDemandAuthorizationContext;

interface BasePaymentIntegrationFormProps {
    paymentMethodOptions: PaymentMethodOptionsResponse;
    countryCode: string;
    invoiceId?: Invoice['id'];
    variant: 'AUTHORIZE' | 'TOKENIZE';
    amount: Amount;
    selectedOption?: string;
    email?: string;
    name?: string;
    validateOnSubmit?: () => Promise<boolean>;
    context?: PaymentAuthorizationContext;
    forceStorePaymentMethod?: boolean;
}

export interface AuthorizePaymentIntegrationFormProps extends BasePaymentIntegrationFormProps {
    customerId?: Customer['id'];
    variant: 'AUTHORIZE';
    context: PaymentAuthorizationContext;
}

export interface TokenizePaymentIntegrationFormProps extends BasePaymentIntegrationFormProps {
    customerId: Customer['id'];
    variant: 'TOKENIZE';
}

export type PaymentIntegrationFormProps =
    | AuthorizePaymentIntegrationFormProps
    | TokenizePaymentIntegrationFormProps;

export type SelectedPaymentMethod = {
    paymentGatewayVariant: PaymentGatewayVariant;
    paymentMethodType: string;
};

export interface PaymentIntegrationFormEmits {
    /**
     * Emitted when a payment method is selected.
     */
    (e: 'select', payload: SelectedPaymentMethod): void;
    /**
     * Emitted when a payment fails.
     */
    (e: 'payment-failed', error: Error): void;
    /**
     * Emitted when a payment is successful.
     */
    (e: 'payment-success'): void;
    /**
     * Emitted when the payment integration form is ready and the payment integration form is initialized.
     */
    (e: 'ready'): void;
}
