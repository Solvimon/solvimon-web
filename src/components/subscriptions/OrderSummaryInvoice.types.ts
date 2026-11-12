import type { Invoice, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';

/** A part of the order with a heading of its own, such as one customer's subscriptions. */
export interface OrderSummaryInvoiceSection {
    key: string;
    title: string;
    /** What this part comes to on its own; the totals still come from `invoice`. */
    invoices: Invoice[];
    /** The subscriptions this part is for, named beside its title. */
    subscriptions?: PricingPlanSubscriptionExpanded[];
}

export interface OrderSummaryInvoiceProps {
    invoice: Invoice;
    /** Priced instead of `invoice` in the totals, while a trial runs. */
    trialInvoice?: Invoice;
    isPaid?: boolean;
    collapsible?: 'collapsed' | 'expanded';
    /** Before a country is known, taxes cannot be determined yet. */
    isPreviewWithoutTaxes?: boolean;
    /**
     * `products-inline` lists the products inside the totals instead of above them.
     *
     * @default 'default'
     */
    variant?: 'default' | 'products-inline';
    /** Lists the lines in these parts instead of from `invoice`, each with its own subtotal. */
    sections?: OrderSummaryInvoiceSection[];
    /** Blurs the invoice while a change is priced again, so a total that no longer applies does not read as current. */
    isUpdating?: boolean;
}
