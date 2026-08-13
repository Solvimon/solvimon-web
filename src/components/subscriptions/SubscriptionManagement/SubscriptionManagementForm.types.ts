import type {
    BillingPeriod,
    Currency,
    PaymentMethod,
    PaymentMethodOptionsResponse,
    Pricing,
    PricingGroupExtended,
} from '@solvimon/solvimon-types';

export interface SubscriptionManagementFormProps {
    /** The group being changed. Its pricings are the options the customer picks between. */
    pricingGroup: PricingGroupExtended;
    /** The customer's saved payment methods, to pay the change with. */
    paymentMethods?: PaymentMethod[];
    /**
     * The methods the customer is allowed to add. Adding is only offered while there is something
     * to add.
     */
    paymentMethodOptions?: PaymentMethodOptionsResponse;
    /** Drives how each pricing's amount is rendered on its option. */
    billingPeriod: BillingPeriod;
    currency?: Currency['currencyCode'];
    disabled?: boolean;
}

export interface SubscriptionManagementFormEmits {
    /** The customer wants to pay with a method they have not saved yet. */
    (e: 'add-payment-method'): void;
}

export interface SubscriptionManagementFormModel {
    /**
     * Every enabled pricing on the schedule, not just this group's. The group editor swaps its own
     * entry and leaves the rest alone, so the list stays whole and can be submitted as-is.
     */
    enabledPricingIds: Pricing['id'][];
    paymentMethodId?: PaymentMethod['id'];
}
