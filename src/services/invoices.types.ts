import type {
    Customer,
    PricingPlanSchedule,
    PricingPlanScheduleCustomization,
    PricingPlanSubscription,
} from '@solvimon/types';

export interface GetInvoicePreviewPayload {
    customer: Partial<Customer>;
    pricingPlanSubscriptionId: PricingPlanSubscription['id'];
    startAt?: PricingPlanSchedule['start_at'];
    customizations?: PricingPlanScheduleCustomization[];
}
