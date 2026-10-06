import type { Invoice } from '@solvimon/solvimon-types';
import { handleOnDemandInvoiceCreated } from './SubscriptionDetails.lib';

const invoiceWith = (payment_status: Invoice['payment_status']) =>
    ({ id: 'inv_1', payment_status }) as Invoice;

describe('handleOnDemandInvoiceCreated', () => {
    it('tells the host about a paid order and reloads the wallet it may have topped up', () => {
        const onInvoiceCreated = vi.fn();
        const refreshWalletBalances = vi.fn();

        handleOnDemandInvoiceCreated({
            invoice: invoiceWith('PAID'),
            configuration: { subscriptionId: 'ppsu_1', onInvoiceCreated },
            refreshWalletBalances,
        });

        expect(onInvoiceCreated).toHaveBeenCalledWith({
            invoiceId: 'inv_1',
            paymentStatus: 'PAID',
        });
        expect(refreshWalletBalances).toHaveBeenCalledOnce();
    });

    it('tells the host about an unpaid order too, without reloading the wallet', () => {
        const onInvoiceCreated = vi.fn();
        const refreshWalletBalances = vi.fn();

        handleOnDemandInvoiceCreated({
            invoice: invoiceWith('UNPAID'),
            configuration: { subscriptionId: 'ppsu_1', onInvoiceCreated },
            refreshWalletBalances,
        });

        expect(onInvoiceCreated).toHaveBeenCalledWith({
            invoiceId: 'inv_1',
            paymentStatus: 'UNPAID',
        });
        expect(refreshWalletBalances).not.toHaveBeenCalled();
    });

    it('needs no callback from the host', () => {
        expect(() =>
            handleOnDemandInvoiceCreated({
                invoice: invoiceWith('PAID'),
                configuration: { subscriptionId: 'ppsu_1' },
                refreshWalletBalances: vi.fn(),
            }),
        ).not.toThrow();
    });
});
