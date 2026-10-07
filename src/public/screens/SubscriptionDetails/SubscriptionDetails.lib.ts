import type { Invoice } from '@solvimon/solvimon-types';
import type { SubscriptionDetailsConfiguration } from './SubscriptionDetails.configuration.types';

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
