import type {
    BillingPeriod,
    Currency,
    PaymentMethod,
    PricingGroupExtended,
} from '@solvimon/solvimon-types';

export interface SubscriptionManagementFormProps {
    /** Lets a submit button outside the form name it with its `form` attribute. */
    id?: string;
    /** The group being changed. Its pricings are the options the customer picks between. */
    pricingGroup: PricingGroupExtended;
    /**
     * What the change can be charged to. The API only charges the subscription's own method, so
     * nothing can be added here.
     */
    paymentMethods?: PaymentMethod[];
    /** Drives how each pricing's amount is rendered on its option. */
    billingPeriod: BillingPeriod;
    currency?: Currency['currencyCode'];
    disabled?: boolean;
}

export interface SubscriptionManagementFormEmits {
    /** The customer submitted the form, from its own fields or a button tied to it by `form`. */
    (e: 'submit'): void;
}
