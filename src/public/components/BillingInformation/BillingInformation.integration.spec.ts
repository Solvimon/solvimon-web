import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Customer } from '@solvimon/types';
import BillingInformation from './BillingInformation.vue';

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
        CustomerBillingInformation: defineComponent({
            name: 'CustomerBillingInformationStub',
            props: {
                customer: { type: Object, required: true },
                fallbackToReference: { type: Boolean, default: true },
            },
            setup(props, { slots }) {
                return () =>
                    h('section', { 'data-testid': 'customer-billing-information' }, [
                        h(
                            'div',
                            { 'data-testid': 'customer-email' },
                            String((props.customer as { email?: string }).email),
                        ),
                        slots.settings?.(),
                    ]);
            },
        }),
    };
});

describe('BillingInformation component', () => {
    const customer = {
        id: 'cus_123',
        email: 'billing@example.com',
        reference: 'CUS-001',
        organization: {
            legal_name: 'Solvimon BV',
            tax_id: 'NL123456789B01',
            registered_address: {
                line1: 'Main street 1',
                postal_code: '1000AA',
                city: 'Amsterdam',
                country: 'NL',
            },
        },
    } as unknown as Customer;

    const mountComponent = ({
        isLoading = false,
        configuration,
    }: {
        isLoading?: boolean;
        configuration?: {
            showEditButton?: boolean;
        };
    } = {}) =>
        mount(BillingInformation, {
            props: {
                customer,
                isLoading,
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

        expect(wrapper.get('[data-testid="billing-information-skeleton"]')).toBeTruthy();
        expect(wrapper.text()).toBe('');
        expect(wrapper.findAll('button')).toHaveLength(0);
    });

    it('renders the billing information content', () => {
        const wrapper = mountComponent();

        expect(wrapper.get('[data-testid="customer-billing-information"]')).toBeTruthy();
        expect(wrapper.get('[data-testid="customer-email"]').text()).toBe('billing@example.com');
    });

    it('renders the edit button when showEditButton is true', () => {
        const wrapper = mountComponent({
            configuration: {
                showEditButton: true,
            },
        });

        expect(wrapper.text()).toContain('Edit');
    });

    it('does not render the edit button when showEditButton is false', () => {
        const wrapper = mountComponent({
            configuration: {
                showEditButton: false,
            },
        });

        expect(wrapper.text()).not.toContain('Edit');
    });

    it('dispatches the edit billing information action when clicked', async () => {
        const wrapper = mountComponent({
            configuration: {
                showEditButton: true,
            },
        });

        await getButtonByText(wrapper, 'Edit').trigger('click');

        expect(mockDispatchAction).toHaveBeenCalledWith({
            action: 'edit-billing-information',
        });
    });
});
