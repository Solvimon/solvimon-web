import type { Invoice } from '@solvimon/solvimon-types';
import type { SubscriptionDetailsConfiguration } from './SubscriptionDetails.types';

/**
 * An on-demand order created an invoice. The host hears about every one, paid or not, since an
 * unpaid one is still a new invoice to them. The wallet only changes once the order is paid, when
 * an item that grants credits has granted them.
 */
export function handleOnDemandInvoiceCreated({
    invoice,
    configuration,
    refreshWalletBalances,
}: {
    invoice: Invoice;
    configuration: SubscriptionDetailsConfiguration;
    refreshWalletBalances: () => void;
}): void {
    if (invoice.payment_status === 'PAID') {
        refreshWalletBalances();
    }

    configuration.onInvoiceCreated?.({
        invoiceId: invoice.id,
        paymentStatus: invoice.payment_status,
    });
}
