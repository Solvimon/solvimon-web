import { mount } from '@vue/test-utils';
import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import SubscriptionsList from './SubscriptionsList.vue';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({
        dispatchAction: mockDispatchAction,
    }),
}));

describe('SubscriptionsList component', () => {
    const customer = {
        id: 'cus_123',
        timezone: 'Europe/Amsterdam',
    } as unknown as Customer;

    const paymentMethods = [
        {
            id: 'pm_card',
        } as unknown as PaymentMethod,
    ];

    const createSubscription = ({
        id = 'sub_123',
        name = 'Starter Plan',
        description = 'Base plan description',
        nextInvoiceDate = '2026-04-01T00:00:00.000Z',
        paymentMethodId = 'pm_card',
        inactivePeriods,
    }: {
        id?: string;
        name?: string;
        description?: string;
        nextInvoiceDate?: string;
        paymentMethodId?: string;
        inactivePeriods?: unknown[];
    } = {}) =>
        ({
            id,
            name,
            payment_method_id: paymentMethodId,
            inactive_periods: inactivePeriods,
            next_invoice: nextInvoiceDate
                ? {
                      invoice_date: nextInvoiceDate,
                  }
                : undefined,
            pricing_plan_schedule_infos: [
                {
                    pricing_plan_version: {
                        pricing_plan: {
                            name: `${name} pricing plan`,
                            description,
                        },
                    },
                },
            ],
        }) as unknown as PricingPlanSubscriptionExpanded;

    const mountComponent = ({
        subscriptions = [createSubscription()],
        configuration,
        isLoading = false,
    }: {
        subscriptions?: PricingPlanSubscriptionExpanded[];
        configuration?: {
            maxItems?: number;
            showViewAllButton?: boolean;
            showViewDetailsButton?: boolean;
        };
        isLoading?: boolean;
    } = {}) =>
        mount(SubscriptionsList, {
            props: {
                customer,
                subscriptions,
                paymentMethods,
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

        const skeleton = wrapper.get('[data-testid="subscriptions-list-skeleton"]');

        expect(skeleton).toBeTruthy();
        expect(wrapper.text()).toBe('');
        expect(wrapper.findAll('button')).toHaveLength(0);
    });

    it('renders the view all button when showViewAllButton is true and there are more than maxItems subscriptions', () => {
        const wrapper = mountComponent({
            subscriptions: [createSubscription(), createSubscription({ id: 'sub_456' })],
            configuration: {
                showViewAllButton: true,
                maxItems: 1,
            },
        });

        expect(wrapper.text()).toContain('View all');
    });

    describe('correct rendering of subscriptions', () => {
        it('renders the subscription name', () => {
            const wrapper = mountComponent({
                subscriptions: [createSubscription({ name: 'Pro subscription' })],
            });

            expect(wrapper.text()).toContain('Pro subscription');
        });

        it('renders the subscription description', () => {
            const wrapper = mountComponent({
                subscriptions: [createSubscription({ description: 'Priority support included' })],
            });

            expect(wrapper.text()).toContain('Priority support included');
        });

        it('renders the subscription next billing date', () => {
            const wrapper = mountComponent({
                subscriptions: [
                    createSubscription({
                        nextInvoiceDate: '2026-05-20T00:00:00.000Z',
                    }),
                ],
            });

            expect(wrapper.text()).toContain('Next billing date');
            expect(wrapper.text()).toContain('20/05/2026');
        });

        it('renders the subscription payment method', () => {
            const wrapper = mountComponent();

            expect(wrapper.findComponent({ name: 'PaymentMethod' }).exists()).toBe(true);
        });
    });

    describe('view all button', () => {
        it('is not rendered when showViewAllButton is false', () => {
            const wrapper = mountComponent({
                configuration: {
                    showViewAllButton: false,
                },
            });

            expect(wrapper.text()).not.toContain('View all');
        });

        it('is rendered when showViewAllButton is true but there are less than maxItems subscriptions', () => {
            const wrapper = mountComponent({
                subscriptions: [createSubscription()],
                configuration: {
                    showViewAllButton: true,
                    maxItems: 2,
                },
            });

            expect(wrapper.text()).toContain('View all');
        });

        it('is rendered when showViewAllButton is true and there are more than maxItems subscriptions', () => {
            const wrapper = mountComponent({
                subscriptions: [createSubscription(), createSubscription({ id: 'sub_456' })],
                configuration: {
                    showViewAllButton: true,
                    maxItems: 1,
                },
            });

            expect(wrapper.text()).toContain('View all');
        });
    });

    describe('view subscription details button', () => {
        it('is not rendered when showViewDetailsButton is false', () => {
            const wrapper = mountComponent({
                configuration: {
                    showViewDetailsButton: false,
                },
            });

            expect(wrapper.text()).not.toContain('Subscription details');
        });

        it('is rendered when showViewDetailsButton is true', () => {
            const wrapper = mountComponent({
                configuration: {
                    showViewDetailsButton: true,
                },
            });

            expect(wrapper.text()).toContain('Subscription details');
        });

        it('dispatches the view subscription details action when clicked', async () => {
            const wrapper = mountComponent({
                subscriptions: [createSubscription({ id: 'sub_details' })],
            });

            await getButtonByText(wrapper, 'Subscription details').trigger('click');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'view-subscription-details',
                data: { subscriptionId: 'sub_details' },
            });
        });
    });
});
