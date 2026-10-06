import type { Invoice } from '@solvimon/solvimon-types';
import type { SubscriptionDetailsConfiguration } from './SubscriptionDetails.configuration.types';

/** An on-demand order created an invoice. The host hears about every one, paid or not. */
export function reportInvoiceCreated({
    invoice,
    configuration,
}: {
    invoice: Invoice;
    configuration: SubscriptionDetailsConfiguration;
}): void {
    configuration.onInvoiceCreated?.({
        invoiceId: invoice.id,
        paymentStatus: invoice.payment_status,
    });
}
