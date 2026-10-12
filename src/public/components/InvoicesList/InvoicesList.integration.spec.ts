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

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    const { defineComponent, h } = await import('vue');
    return createSolvimonUiMock({
        // ErrorNotification resolves its own IntlProvider internally, which is not mounted here.
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
    });
});

describe('InvoicesList component', () => {
    const createInvoice = ({
        id = 'inv_123',
        invoiceNumber = 'INV-001',
        invoiceDate = '2026-05-20T00:00:00.000Z',
        paid = false,
        status = 'FINAL',
        type = 'STANDARD',
        openAmount = paid ? '0' : '1000',
        timezone,
    }: {
        id?: string;
        invoiceNumber?: string;
        invoiceDate?: string;
        paid?: boolean;
        status?: Invoice['status'];
        type?: Invoice['type'];
        openAmount?: string;
        timezone?: string;
    } = {}) =>
        ({
            id,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            paid,
            status,
            type,
            timezone,
            open_invoice_amount: { currency: 'EUR', quantity: openAmount },
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
        error = null,
    }: {
        invoices?: Invoice[];
        configuration?: InvoicesListConfiguration;
        hasMoreItems?: boolean;
        isLoading?: boolean;
        error?: Error | null;
    } = {}) =>
        mount(InvoicesList, {
            props: {
                invoices,
                configuration,
                hasMoreItems,
                isLoading,
                error,
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

    it.each([
        ['a credit note', { type: 'CREDIT' }, 'Credit note'],
        ['a one-off credit note', { type: 'ONE_OFF_CREDIT' }, 'Credit note'],
        ['a voided invoice', { status: 'VOID' }, 'Void'],
        ['a draft invoice', { status: 'DRAFT' }, undefined],
        ['an empty invoice', { status: 'EMPTY' }, undefined],
        ['an invoice with nothing left open', { openAmount: '0' }, undefined],
    ] as const)('offers no pay button for %s', (_, overrides, chip) => {
        const wrapper = mountComponent({ invoices: [createInvoice(overrides)] });

        expect(wrapper.findAll('button').some((button) => button.text() === 'Pay')).toBe(false);
        if (chip) {
            expect(
                wrapper.get('.sv-invoices-list__row .sv-invoices-list__cell--status').text(),
            ).toBe(chip);
        }
    });

    it('treats an invoice the API marks as paid through its payment status as paid', () => {
        const invoice = { ...createInvoice(), paid: null, payment_status: 'PAID' } as Invoice;
        const wrapper = mountComponent({ invoices: [invoice] });

        expect(wrapper.get('.sv-invoices-list__row .sv-invoices-list__cell--status').text()).toBe(
            'Paid',
        );
    });

    it('dates an invoice in the timezone it was issued in', () => {
        const wrapper = mountComponent({
            invoices: [
                createInvoice({
                    // Still the 19th in Amsterdam, the customer's timezone now.
                    invoiceDate: '2026-05-19T20:00:00.000Z',
                    timezone: 'Asia/Tokyo',
                }),
            ],
        });

        expect(wrapper.text()).toContain('20/05/2026');
        expect(wrapper.text()).not.toContain('19/05/2026');
    });

    it('names the row button after the invoice it opens', () => {
        const wrapper = mountComponent({
            invoices: [createInvoice({ invoiceNumber: 'INV-042' })],
        });

        expect(getRowOverlayButton(wrapper)!.attributes('aria-label')).toBe('View invoice INV-042');
    });

    it('says so when the invoices could not be loaded, and keeps load more to try again', () => {
        const wrapper = mountComponent({ hasMoreItems: true, error: new Error('Boom') });

        expect(wrapper.text()).toContain('We could not load your invoices. Please try again.');
        expect(wrapper.text()).toContain('Load more');
    });

    it('shows no error while the invoices load fine', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-invoices-list__error').exists()).toBe(false);
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
