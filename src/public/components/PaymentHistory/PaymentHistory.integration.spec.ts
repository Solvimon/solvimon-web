import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { ApiSuccessCollectionResponse, Customer, Invoice, Payment } from '@solvimon/solvimon-types';
import PaymentHistoryEntry from './PaymentHistory.entry.vue';
import type { SolvimonPaymentHistoryEntryProps } from './PaymentHistory.entry.types';

const { mockUseInvoiceData } = vi.hoisted(() => ({
    mockUseInvoiceData: vi.fn(),
}));

vi.mock('./PaymentHistory.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-payment-history',
    SolvimonPaymentHistory: {},
    defineSolvimonPaymentHistory: () => {},
}));

vi.mock('@/composables/useInvoiceData', () => ({
    useInvoiceData: mockUseInvoiceData,
}));

vi.mock('@/components/providers', async () => ({
    Provider: defineComponent({
        setup(_, { slots }) {
            return () => slots.default?.();
        },
    }),
    useActionDispatchProvider: () => ({
        dispatchAction: vi.fn(),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return {
        ...actual,
        useIntl: () => ({
            $t: (message: { defaultMessage: string }) => message.defaultMessage,
            formatDate: ({
                date,
                format,
                timezone,
            }: {
                date: Date | string;
                format: 'date' | 'dateTime';
                timezone?: string;
            }) => {
                const options: Intl.DateTimeFormatOptions =
                    format === 'date'
                        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
                        : {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false,
                          };
                return new Intl.DateTimeFormat('en-GB', {
                    ...options,
                    ...(timezone ? { timeZone: timezone } : {}),
                }).format(new Date(date));
            },
        }),
        PaymentMethod: defineComponent({
            name: 'PaymentMethodStub',
            props: { paymentMethod: { type: Object, required: true } },
            setup(_, { slots }) {
                return () => h('div', { 'data-testid': 'payment-method-stub' }, [slots.description?.()]);
            },
        }),
    };
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
        data?: ReturnType<typeof createData> | undefined;
    } = {}) => {
        mockUseInvoiceData.mockReturnValue({
            data: ref(data),
            isPending: ref(isPending),
        });

        return mount(PaymentHistoryEntry, {
            props: {
                environment: 'TEST',
                locale: 'en-US',
                customElementName: 'solvimon-payment-history',
                portalObject: {
                    object_type: 'PORTAL_URL',
                    id: 'purl_example',
                    type: 'CUSTOMER',
                    customer_id: 'cust_example',
                    token: 'test-portal-token',
                    status: 'PUBLISHED',
                } as unknown as SolvimonPaymentHistoryEntryProps['portalObject'],
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

        expect(mockUseInvoiceData).toHaveBeenCalledWith(invoiceId);
    });

    it('renders nothing while data is initially being fetched', () => {
        const wrapper = mountComponent({ isPending: true, data: undefined });

        expect(wrapper.text()).toBe('');
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
