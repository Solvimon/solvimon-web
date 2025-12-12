import type { CountryCode, Invoice, Pricing, TimePeriod } from '@solvimon/types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface OrderSummaryProps {
    /**
     * The subscription to display.
     */
    subscription: PricingPlanSubscriptionExpanded;
    /**
     * The invoice to display.
     */
    invoice?: Invoice;
    /**
     * The trial invoice to display.
     */
    trialInvoice?: Invoice;
    /**
     * The pricing ids to display.
     */
    enabledPricingIds?: Pricing['id'][];
    /**
     * The trial period to display.
     */
    trialPeriod?: TimePeriod;
    /**
     * The avatar to display.
     */
    avatar?: string;
    /**
     * Whether the invoice is paid.
     */
    isPaid?: boolean;
    /**
     * Whether the invoice is usage based.
     */
    isUsageBased?: boolean;
    /**
     * Whether the preview and payment methods are pending.
     */
    isPreviewAndPaymentMethodsPending?: boolean;
    /**
     * Whether the subscription is collapsible, if not provided,
     * the subscription will be displayed in the expanded state.
     * When a value is provided, the subscription will be collapsible
     * and the value will determine the initial state.
     */
    collapsible?: 'collapsed' | 'expanded';
    /**
     * Whether to hide the title.
     *
     * @default false
     */
    noTitle?: boolean;
    /**
     * The country code used to calculate the taxes.
     */
    countryCode: CountryCode | undefined;
}
