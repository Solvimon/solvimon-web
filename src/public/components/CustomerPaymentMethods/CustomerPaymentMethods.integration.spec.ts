import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentMethod, PaymentMethodOption } from '@solvimon/solvimon-types';
import CustomerPaymentMethods from './CustomerPaymentMethods.vue';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({
        dispatchAction: mockDispatchAction,
    }),
}));

vi.mock('@solvimon/ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/ui')>('@solvimon/ui');

    return {
        ...actual,
        useIntl: () => ({
            $t: (
                message: {
                    defaultMessage: string;
                },
                values?: Record<string, string>,
            ) => {
                if (values?.count && message.defaultMessage.includes('Payment method')) {
                    return values.count === '1' ? 'Payment method' : 'Payment methods';
                }

                return message.defaultMessage;
            },
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
            props: {
                paymentMethod: { type: Object, required: true },
            },
            setup(props) {
                return () =>
                    h(
                        'div',
                        { 'data-testid': 'payment-method-stub' },
                        String((props.paymentMethod as { id?: string }).id),
                    );
            },
        }),
    };
});

describe('CustomerPaymentMethods component', () => {
    const createPaymentMethod = ({
        id = 'pm_123',
    }: {
        id?: string;
    } = {}) =>
        ({
            id,
            type: 'CARD',
            card: {
                brand: 'visa',
                last4: '4242',
                expiration_month: 12,
                expiration_year: 2030,
            },
        }) as unknown as PaymentMethod;

    const paymentMethodsOptions = [
        {
            type: 'CARD',
        } as unknown as PaymentMethodOption,
    ];

    const mountComponent = ({
        paymentMethods = [createPaymentMethod()],
        configuration,
        isLoading = false,
    }: {
        paymentMethods?: PaymentMethod[];
        configuration?: {
            maxItems?: number;
            showViewAllButton?: boolean;
            showAddButton?: boolean;
        };
        isLoading?: boolean;
    } = {}) =>
        mount(CustomerPaymentMethods, {
            props: {
                isLoading,
                paymentMethods,
                paymentMethodsOptions,
                configuration,
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the skeleton when isLoading is true', () => {
        const wrapper = mountComponent({
            isLoading: true,
        });

        expect(wrapper.get('[data-testid="customer-payment-methods-skeleton"]')).toBeTruthy();
        expect(wrapper.text()).toBe('');
        expect(wrapper.findAll('button')).toHaveLength(0);
    });

    it('renders the payment methods title and payment method content', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Payment method');
        expect(wrapper.findComponent({ name: 'PaymentMethodStub' }).exists()).toBe(true);
    });

    it('dispatches the view all payment methods action when clicked', async () => {
        const wrapper = mountComponent({
            configuration: {
                showViewAllButton: true,
            },
        });

        await getButtonByText(wrapper, 'View all').trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({
            action: 'view-all-payment-methods',
        });
    });

    it('does not render the view all button when showViewAllButton is false', () => {
        const wrapper = mountComponent({
            configuration: {
                showViewAllButton: false,
            },
        });

        expect(wrapper.text()).not.toContain('View all');
    });

    it('renders the add payment method button when there are no payment methods and showAddButton is true', () => {
        const wrapper = mountComponent({
            paymentMethods: [],
            configuration: {
                showAddButton: true,
            },
        });

        expect(wrapper.text()).toContain('Add payment method');
        expect(wrapper.text()).toContain(
            'Add a payment method for recurring invoice payments.',
        );
    });

    it('does not render the add payment method button when there are no payment methods and showAddButton is false', () => {
        const wrapper = mountComponent({
            paymentMethods: [],
            configuration: {
                showAddButton: false,
            },
        });

        expect(wrapper.text()).not.toContain('Add payment method');
    });

    it('dispatches the add payment method action when clicked', async () => {
        const wrapper = mountComponent({
            paymentMethods: [],
            configuration: {
                showAddButton: true,
            },
        });

        await getButtonByText(wrapper, 'Add payment method').trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({
            action: 'add-payment-method',
        });
    });
});
