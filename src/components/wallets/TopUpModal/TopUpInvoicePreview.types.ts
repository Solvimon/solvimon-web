import type {
    ChargeOnDemandPricingItemsPricingItemConfig,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';

export interface TopUpInvoicePreviewProps {
    /** The schedule the top-up is billed on, without which there is nothing to price it against. */
    pricingPlanScheduleId?: PricingPlanSchedule['id'];
    /**
     * What is being charged. Undefined until there is something chargeable — a top-up with no amount
     * entered yet has nothing to preview, and the placeholder stands aside rather than holding space
     * for a total that is never coming.
     */
    pricingItems?: ChargeOnDemandPricingItemsPricingItemConfig[];
}
