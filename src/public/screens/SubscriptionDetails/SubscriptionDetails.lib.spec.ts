import type { Invoice } from '@solvimon/solvimon-types';
import { reportInvoiceCreated } from './SubscriptionDetails.lib';

const invoiceWith = (payment_status: Invoice['payment_status']) =>
    ({ id: 'inv_1', payment_status }) as Invoice;

describe('reportInvoiceCreated', () => {
    it.each(['PAID', 'UNPAID'] as const)('tells the host about a %s order', (paymentStatus) => {
        const onInvoiceCreated = vi.fn();

        reportInvoiceCreated({
            invoice: invoiceWith(paymentStatus),
            configuration: { subscriptionId: 'ppsu_1', onInvoiceCreated },
        });

        expect(onInvoiceCreated).toHaveBeenCalledWith({ invoiceId: 'inv_1', paymentStatus });
    });

    it('needs no callback from the host', () => {
        expect(() =>
            reportInvoiceCreated({
                invoice: invoiceWith('PAID'),
                configuration: { subscriptionId: 'ppsu_1' },
            }),
        ).not.toThrow();
    });
});
