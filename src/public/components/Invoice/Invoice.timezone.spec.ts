import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ErrorHandlingProvider, IntlProvider } from '@solvimon/solvimon-ui';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceHeader from '@/public/components/InvoiceHeader/InvoiceHeader.vue';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';

// The Invoice component renders both of these side by side, with the real library header.
describe('Invoice dates across the header and the details', () => {
    const invoice = {
        id: 'inv_1',
        invoice_number: 'INV-1',
        status: 'FINAL',
        // 23:30 UTC on the 14th is already the 15th in Amsterdam.
        invoice_date: '2024-01-14T23:30:00Z',
        due_date: '2024-02-14T23:30:00Z',
        timezone: 'UTC',
        customer: { id: 'cus_1', timezone: 'Europe/Amsterdam' },
    } as unknown as Invoice;

    const mountBoth = () =>
        mount(
            defineComponent({
                setup: () => () =>
                    h(ErrorHandlingProvider, {}, () =>
                        h(IntlProvider, { locale: 'en-GB' }, () => [
                            h('div', { 'data-testid': 'header' }, [
                                h(InvoiceHeader, {
                                    invoice,
                                    payments: [],
                                    invoiceDownloadService: async () => {},
                                    isLoading: false,
                                    configuration: {
                                        invoiceId: 'inv_1',
                                        enableDownloadButton: false,
                                    },
                                }),
                            ]),
                            h('div', { 'data-testid': 'details' }, [
                                h(InvoiceDetailsBlock, { invoice }),
                            ]),
                        ]),
                    ),
            }),
        );

    it('renders both, with the details in the invoice timezone', () => {
        const wrapper = mountBoth();

        expect(wrapper.get('[data-testid="details"]').text()).toContain('14/01/2024');
        expect(wrapper.get('[data-testid="header"]').text()).toContain('INV-1');
    });

    // The library header dates the invoice in `customer.timezone`; it is handed the invoice's own.
    it('gives the invoice the same date in the header as in the details', () => {
        const wrapper = mountBoth();
        const header = wrapper.get('[data-testid="header"]').text();
        const details = wrapper.get('[data-testid="details"]').text();

        expect(details).toContain('14/01/2024');
        expect(header).toContain('14/01/2024');
    });
});
