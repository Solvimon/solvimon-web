import type {
    Customer,
    PricingPlanSchedule,
    PricingPlanScheduleCustomization,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';

/**
 * The details a preview is calculated for. Incomplete on purpose — a customer signing up is priced
 * for what they have filled in so far.
 */
export type GetInvoicePreviewCustomer = Partial<Customer>;

interface GetInvoicePreviewPayloadBase {
    pricingPlanSubscriptionId: PricingPlanSubscription['id'];
    startAt?: PricingPlanSchedule['start_at'];
    customizations?: PricingPlanScheduleCustomization[];
    pricing_plan_schedule_customizations?: PricingPlanScheduleCustomization[];
}

/**
 * A subscription that is already running is priced as itself, and the customer it belongs to is
 * known — so only its id goes out. One that does not exist yet is priced off the template it would
 * be created from, and the details it would be invoiced to have to be sent along, since they decide
 * the tax and the pricing currency.
 */
export type GetInvoicePreviewPayload =
    | (GetInvoicePreviewPayloadBase & {
          forExistingSubscription: true;
          customer?: never;
      })
    | (GetInvoicePreviewPayloadBase & {
          forExistingSubscription?: false;
          customer: GetInvoicePreviewCustomer;
      });
