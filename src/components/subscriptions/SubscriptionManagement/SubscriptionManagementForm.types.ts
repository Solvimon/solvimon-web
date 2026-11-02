import type {
    BillingPeriod,
    Currency,
    PaymentMethod,
    PricingGroupExtended,
} from '@solvimon/solvimon-types';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

export interface SubscriptionManagementFormProps {
    /** Lets a submit button outside the form name it with its `form` attribute. */
    id?: string;
    /** Absent when the plan offers nothing to customise, or while another plan is picked. */
    pricingGroup?: PricingGroupExtended;
    /** Cheapest first. Fewer than two leaves the plan choice out. */
    planOptions?: SubscriptionPlanOption[];
    paymentMethods?: PaymentMethod[];
    /** The subscription's own method is a card that has expired, so it is not on offer. */
    hasExpiredPaymentMethod?: boolean;
    billingPeriod: BillingPeriod;
    currency?: Currency['currencyCode'];
    disabled?: boolean;
    avatar?: string;
    /** @default true */
    canAddPaymentMethod?: boolean;
}

export interface SubscriptionManagementFormEmits {
    (e: 'submit'): void;
    (e: 'add-payment-method'): void;
}
