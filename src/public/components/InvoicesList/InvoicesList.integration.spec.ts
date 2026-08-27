import { mount } from '@vue/test-utils';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoicesList from './InvoicesList.vue';
import type { InvoicesListConfiguration } from './InvoicesList.types';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({
        dispatchAction: mockDispatchAction,
    }),
}));

describe('InvoicesList component', () => {
    const createInvoice = ({
        id = 'inv_123',
        invoiceNumber = 'INV-001',
        invoiceDate = '2026-05-20T00:00:00.000Z',
        paid = false,
    }: {
        id?: string;
        invoiceNumber?: string;
        invoiceDate?: string;
        paid?: boolean;
    } = {}) =>
        ({
            id,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            paid,
            customer: {
                timezone: 'Europe/Amsterdam',
            },
            invoice_amount_including_tax: {
                currency: 'EUR',
                quantity: '1000',
            },
        }) as unknown as Invoice;

    const mountComponent = ({
        invoices = [createInvoice()],
        configuration,
        hasMoreItems = false,
        isLoading = false,
    }: {
        invoices?: Invoice[];
        configuration?: InvoicesListConfiguration;
        hasMoreItems?: boolean;
        isLoading?: boolean;
    } = {}) =>
        mount(InvoicesList, {
            props: {
                invoices,
                configuration,
                hasMoreItems,
                isLoading,
            },
            global: {
                stubs: {
                    teleport: true,
                },
            },
        });

    const getButtonByText = (wrapper: ReturnType<typeof mountComponent>, label: string) => {
        const button = wrapper.findAll('button').find((item) => item.text() === label);

        expect(button).toBeDefined();

        return button!;
    };

    const getRowOverlayButton = (wrapper: ReturnType<typeof mountComponent>) =>
        wrapper
            .findAll('button')
            .find((item) => item.attributes('class')?.includes('absolute inset-0 h-full w-full'));

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the invoices title', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Invoices');
    });

    it('renders the invoice number and invoice date', () => {
        const wrapper = mountComponent({
            invoices: [createInvoice({ invoiceNumber: 'INV-999' })],
        });

        expect(wrapper.text()).toContain('INV-999');
        expect(wrapper.text()).toContain('20/05/2026');
    });

    it('renders the pay button for unpaid invoices when showPayButton is true', () => {
        const wrapper = mountComponent({
            configuration: {
                showPayButton: true,
            },
        });

        expect(wrapper.text()).toContain('Pay');
    });

    it('does not render the pay button when showPayButton is false', () => {
        const wrapper = mountComponent({
            configuration: {
                showPayButton: false,
            },
        });

        expect(wrapper.text()).not.toContain('Pay');
    });

    it('renders a paid chip instead of the pay button for paid invoices', () => {
        const wrapper = mountComponent({
            invoices: [createInvoice({ paid: true })],
        });

        expect(wrapper.text()).toContain('Paid');
        expect(wrapper.text()).not.toContain('Pay');
    });

    it('dispatches the pay invoice action when the pay button is clicked', async () => {
        const wrapper = mountComponent({
            invoices: [createInvoice({ id: 'inv_pay' })],
        });

        await getButtonByText(wrapper, 'Pay').trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({
            action: 'pay-invoice',
            data: { invoiceId: 'inv_pay' },
        });
    });

    it('dispatches the view invoice action when an invoice row is clicked and showViewButton is true', async () => {
        const wrapper = mountComponent({
            invoices: [createInvoice({ id: 'inv_view' })],
            configuration: {
                showViewButton: true,
            },
        });

        const rowOverlayButton = getRowOverlayButton(wrapper);

        expect(rowOverlayButton).toBeDefined();
        await rowOverlayButton!.trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({
            action: 'view-invoice',
            data: { invoiceId: 'inv_view' },
        });
    });

    it('does not render the row overlay button when showViewButton is false', () => {
        const wrapper = mountComponent({
            configuration: {
                showViewButton: false,
            },
        });

        const rowOverlayButton = getRowOverlayButton(wrapper);

        expect(rowOverlayButton).toBeUndefined();
    });

    it('renders the load more button when hasMoreItems is true', () => {
        const wrapper = mountComponent({
            hasMoreItems: true,
        });

        expect(wrapper.text()).toContain('Load more');
    });

    it('re-emits load-more when the load more button is clicked', async () => {
        const wrapper = mountComponent({
            hasMoreItems: true,
        });

        await getButtonByText(wrapper, 'Load more').trigger('click');

        expect(wrapper.emitted('load-more')).toEqual([[]]);
    });

    it('keeps the options a partial configuration leaves out at their default', () => {
        const wrapper = mountComponent({
            configuration: {
                pagination: { batchSize: 20 },
            },
            hasMoreItems: true,
        });

        expect(wrapper.text()).toContain('Pay');
        expect(wrapper.text()).toContain('Load more');
        expect(getRowOverlayButton(wrapper)).toBeDefined();
    });

    it('does not render the load more button when pagination is disabled', () => {
        const wrapper = mountComponent({
            configuration: {
                pagination: { enabled: false },
            },
            hasMoreItems: true,
        });

        expect(wrapper.text()).not.toContain('Load more');
    });
});
