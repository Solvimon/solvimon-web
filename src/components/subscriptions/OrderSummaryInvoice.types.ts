import type { Invoice } from '@solvimon/solvimon-types';

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
    /** Blurs the invoice while a change is priced again, so a total that no longer applies does not read as current. */
    isUpdating?: boolean;
}
