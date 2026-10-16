import type {
    Address,
    Amount,
    AuthorizePaymentInitPricingPlanSubscriptionContext,
    AuthorizePaymentPayload,
    Customer,
    Name,
    Invoice,
    PaymentGatewayVariant,
    PaymentMethodOptionResponseEntry,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { SdkError } from '@/types/errors';

export interface ChargeOnDemandAuthorizationContext {
    type: 'CHARGE_ON_DEMAND';
    charge_on_demand: {
        pricing_plan_schedule_id: string;
        pricing_items: Array<{ pricing_item_id: string }>;
    };
}

/**
 * Where a checkout order ships. The API upserts it by `reference` for the customer the checkout
 * creates and links it to the new subscription. Not in `@solvimon/solvimon-types` yet.
 */
export interface ShippingAddressDetails {
    reference: string;
    recipient: {
        type: Customer['type'];
        individual?: { name: Name };
        organization?: { company_name: string; attention_name?: string };
        phone_number: string;
        email: string;
    };
    address: Address;
}

export interface CheckoutAuthorizationContext extends AuthorizePaymentInitPricingPlanSubscriptionContext {
    init_pricing_plan_subscription: AuthorizePaymentInitPricingPlanSubscriptionContext['init_pricing_plan_subscription'] & {
        shipping_address_details?: ShippingAddressDetails;
    };
}

export type PaymentAuthorizationContext =
    | AuthorizePaymentPayload['context']
    | CheckoutAuthorizationContext
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
    storePaymentMethod?: boolean;
    /**
     * Whether the screen sends the customer somewhere else once the payment goes through, so the
     * success card can say so. Only the screen knows: the same form ends a checkout that redirects
     * to the merchant and an invoice payment that stays where it is.
     */
    redirectsOnSuccess?: boolean;
    /**
     * Legal name of the party collecting the money, named in the SEPA mandate. Only the screen
     * knows it — it comes off the invoice when paying one and off the subscription in checkout —
     * and the mandate falls back to unnamed wording without it.
     */
    billingEntityName?: string;
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
    (e: 'payment-failed', error: SdkError): void;
    /**
     * Emitted when a payment is successful.
     */
    (e: 'payment-success'): void;
    /**
     * Emitted when a submit is not sent. `NO_PAYMENT_METHOD` means no payment method is open in
     * the form, so there are no fields of its own to mark.
     */
    (e: 'invalid', reason?: 'NO_PAYMENT_METHOD'): void;
    /**
     * Emitted when a payment is sent, including one the form started itself: Enter in a card field
     * or a wallet's own button. The screen waits on it as on one its own button sent.
     */
    (e: 'submitting'): void;
    /**
     * Emitted when the gateway hands the customer a step to complete inside the form, such as a 3DS
     * challenge. The payment is still on its way, but the form has to stay within reach.
     */
    (e: 'action-required'): void;
    /**
     * Emitted when the payment integration form is ready and the payment integration form is initialized.
     */
    (e: 'ready'): void;
}

/** What every gateway-specific form is handed for the one option it renders. */
export interface PaymentIntegrationVariantProps {
    countryCode: string;
    customerId?: Customer['id'];
    invoiceId?: Invoice['id'];
    paymentMethodOptionResponseEntry: PaymentMethodOptionResponseEntry;
    variant: 'TOKENIZE' | 'AUTHORIZE';
    selected: boolean;
    amount: Amount;
    validateOnSubmit?: () => Promise<boolean>;
    context?: PaymentAuthorizationContext;
    forceStorePaymentMethod?: boolean;
    storePaymentMethod?: boolean;
    redirectsOnSuccess?: boolean;
    /** Named in the SEPA mandate. See the note on the same prop in the base props. */
    billingEntityName?: string;
}

export type PaymentIntegrationVariantEmits = PaymentIntegrationFormEmits;
