import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type {
    ApiSuccessCollectionResponse,
    Customer,
    Invoice,
    Payment,
} from '@solvimon/solvimon-types';
import PaymentHistoryEntry from './PaymentHistory.entry.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockUseInvoiceData } = vi.hoisted(() => ({
    mockUseInvoiceData: vi.fn(),
}));

vi.mock('@/composables/useInvoiceData', () => ({
    useInvoiceData: mockUseInvoiceData,
}));

vi.mock('@/components/providers', async () => {
    const { createProviderMock } = await import('@/test-utils/providerMock');
    return createProviderMock();
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        PaymentMethod: defineComponent({
            name: 'PaymentMethodStub',
            props: { paymentMethod: { type: Object, required: true } },
            setup(_, { slots }) {
                return () =>
                    h('div', { 'data-testid': 'payment-method-stub' }, [slots.description?.()]);
            },
        }),
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

describe('PaymentHistory entry component', () => {
    const invoiceId = 'inv_123';

    const customer = {
        id: 'cus_123',
        timezone: 'Europe/Amsterdam',
    } as unknown as Customer;

    const createPayment = ({
        id = 'pay_123',
        result = 'AUTHORIZED' as Payment['result'],
        createdAt = '2026-01-15T10:00:00.000Z',
    }: {
        id?: string;
        result?: Payment['result'];
        createdAt?: string;
    } = {}) =>
        ({
            id,
            result,
            created_at: createdAt,
            payment_method_details: { type: 'CARD' },
        }) as unknown as Payment;

    const createData = (payments: Payment[] = [createPayment()]) => ({
        invoice: { id: invoiceId, customer } as unknown as Invoice,
        paymentAttempts: { data: payments } as unknown as ApiSuccessCollectionResponse<Payment>,
    });

    const mountComponent = ({
        isPending = false,
        data = createData(),
    }: {
        isPending?: boolean;
        data?: ReturnType<typeof createData> | null;
    } = {}) => {
        mockUseInvoiceData.mockReturnValue({
            data: ref(data ?? undefined),
            isPending: ref(isPending),
        });

        return mount(PaymentHistoryEntry, {
            props: {
                environment: 'TEST',
                locale: 'en-US',
                customElementName: 'solvimon-payment-history',
                portalObject: createTestPortalObject('cust_example'),
                configuration: { invoiceId },
            },
            global: {
                stubs: { teleport: true },
            },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls useInvoiceData with the configured invoice id', () => {
        mountComponent();

        expect(mockUseInvoiceData).toHaveBeenCalledWith(invoiceId, { includePayments: true });
    });

    it('shows a skeleton while the payment history loads, rather than nothing', () => {
        const wrapper = mountComponent({ isPending: true, data: null });

        expect(wrapper.find('[data-testid="payment-history-skeleton"]').exists()).toBe(true);
    });

    it('says so when the payment history could not be loaded', () => {
        const wrapper = mountComponent({ data: null });

        expect(wrapper.text()).toContain(
            'We could not load the payment history. Please try again.',
        );
    });

    it('loads the other invoice when the configured invoice id changes', async () => {
        const wrapper = mountComponent();

        await wrapper.setProps({ configuration: { invoiceId: 'inv_456' } });

        expect(mockUseInvoiceData).toHaveBeenLastCalledWith('inv_456', { includePayments: true });
    });

    it('lists the attempts in the order it shows them, without reversing them in CSS', () => {
        const wrapper = mountComponent({
            data: createData([
                createPayment({ id: 'pay_1', result: 'REFUSED' }),
                createPayment({ id: 'pay_2', result: 'AUTHORIZED' }),
            ]),
        });

        const items = wrapper.get('.sv-payment-history__items');
        expect(
            items.findAll('.sv-payment-history__item-status').map((chip) => chip.text()),
        ).toEqual(['Authorized', 'Refused']);
    });

    // The skeleton is shown when already-loaded data is being refetched (isPending re-triggers
    // while invoice and paymentAttempts are still available from the previous response)
    it('renders the skeleton when data is being reloaded', () => {
        const wrapper = mountComponent({ isPending: true, data: createData() });

        expect(wrapper.get('[data-testid="payment-history-skeleton"]')).toBeTruthy();
        expect(wrapper.text()).toBe('');
    });

    it('renders the payment history title when data is loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Payment history');
    });

    it('renders a payment attempt section for each payment', () => {
        const wrapper = mountComponent({
            data: createData([createPayment({ id: 'pay_1' }), createPayment({ id: 'pay_2' })]),
        });

        expect(wrapper.findAll('[data-testid="payment-method-stub"]')).toHaveLength(2);
    });

    it('renders the payment result as a status chip', () => {
        const wrapper = mountComponent({
            data: createData([createPayment({ result: 'AUTHORIZED' })]),
        });

        expect(wrapper.text()).toContain('Authorized');
    });

    it('renders a refused payment with the correct status', () => {
        const wrapper = mountComponent({
            data: createData([createPayment({ result: 'REFUSED' })]),
        });

        expect(wrapper.text()).toContain('Refused');
    });

    it('renders nothing when there are no payment attempts', () => {
        const wrapper = mountComponent({ data: createData([]) });

        expect(wrapper.text()).not.toContain('Payment history');
    });
});
