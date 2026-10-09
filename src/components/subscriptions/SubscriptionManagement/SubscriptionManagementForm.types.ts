import type {
    BillingPeriod,
    Currency,
    PaymentMethod,
    PaymentMethodOptionsResponse,
    Pricing,
    PricingGroupExtended,
} from '@solvimon/solvimon-types';
import type { PricingPlan } from '@solvimon/solvimon-types';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

export interface SubscriptionManagementFormProps {
    /**
     * The group being changed. Its pricings are the options the customer picks between. Absent for
     * a plan that offers nothing to customise, which a plan change on its own does not need.
     */
    pricingGroup?: PricingGroupExtended;
    /**
     * The plans of the group the current plan belongs to, cheapest first. Fewer than two means
     * there is nothing to move to and the plan choice is left out.
     */
    planOptions?: SubscriptionPlanOption[];
    /** Names the plan choice — the pricing plan group's own name. */
    planGroupName?: string;
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
    /** The plan the subscription should run on, which starts on the one it runs on today. */
    pricingPlanId?: PricingPlan['id'];
}
