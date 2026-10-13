import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import SubscriptionCancellationModal from './SubscriptionCancellationModal.vue';
import SubscriptionsListItem from '@/components/subscriptions/SubscriptionsList/SubscriptionsListItem.vue';

const { mockSetSubscriptionCancellation, mockLogError } = vi.hoisted(() => ({
    mockSetSubscriptionCancellation: vi.fn(),
    mockLogError: vi.fn(),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // The real modal teleports and resolves providers this mount does not have. The stub keeps
        // the parts under test reachable: the body, the two footer buttons and the loading flag.
        Modal: defineComponent({
            name: 'ModalStub',
            props: {
                showModal: Boolean,
                title: String,
                confirmButtonText: String,
                cancelButtonText: String,
                isLoading: Boolean,
            },
            emits: ['confirm', 'close'],
            setup(props, { slots, emit }) {
                return () =>
                    props.showModal
                        ? h('div', { class: 'modal', 'data-loading': String(props.isLoading) }, [
                              h('h1', { class: 'modal__title' }, props.title),
                              h('div', { class: 'modal__body' }, slots.body?.()),
                              h(
                                  'button',
                                  {
                                      class: 'modal__confirm',
                                      onClick: () => emit('confirm'),
                                  },
                                  props.confirmButtonText,
                              ),
                              h(
                                  'button',
                                  { class: 'modal__cancel', onClick: () => emit('close') },
                                  props.cancelButtonText,
                              ),
                          ])
                        : null;
            },
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
        // The real one renders a chip that resolves the IntlProvider directly, which this mount
        // does not have. The stub keeps the last four digits assertable.
        PaymentMethod: defineComponent({
            name: 'PaymentMethodStub',
            props: { paymentMethod: { type: Object, default: undefined }, variant: String },
            setup(props) {
                return () =>
                    h(
                        'div',
                        { class: 'payment-method-stub' },
                        props.paymentMethod?.card?.last_four_digits,
                    );
            },
        }),
    });
});

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({
        setSubscriptionCancellation: mockSetSubscriptionCancellation,
    }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLogError }),
}));

const mockSubscription = {
    id: 'ppsu_1',
    name: 'Pro plan',
    status: 'ACTIVE',
    type: 'BILLING',
    next_invoice: { invoice_date: '2026-09-01T00:00:00Z' },
} as unknown as PricingPlanSubscriptionExpanded;

/** A subscription with no next billing date, so the cancel copy has no day to name. */
const subscriptionWithoutNextInvoice = {
    id: 'ppsu_1',
    name: 'Pro plan',
} as unknown as PricingPlanSubscriptionExpanded;

const mockPaymentMethod = {
    id: 'pmet_1',
    status: 'ACTIVE',
    type: 'CARD',
    card: {
        brand: 'MASTERCARD',
        last_four_digits: '4242',
        expiry_date: { expiry_month: 3, expiry_year: 2030 },
    },
} as unknown as PaymentMethod;

/**
 * Shaped like the expanded subscription the details screen loads: the schedule names the enabled
 * pricing, and the plan version carries the pricing it points at. Both are needed for the summary
 * to show the same subline the checkout does.
 */
const subscriptionWithPricings = {
    ...mockSubscription,
    pricing_plan_schedule_infos: [
        {
            id: 'ppsc_1',
            start_at: '2020-01-01T00:00:00Z',
            pricing_plan_schedule: {
                type: 'DEFAULT',
                enabled_pricings: [{ pricing_id: 'pric_1' }],
            },
            pricing_plan_version: {
                pricing_plan: { name: 'Credit packs', description: '100,000 monthly credits' },
                pricing_categories: [
                    {
                        pricing_groups: [
                            {
                                pricings: [
                                    {
                                        object_type: 'PRICING',
                                        id: 'pric_1',
                                        name: 'Credit pack 10 000 per month',
                                    },
                                    {
                                        object_type: 'PRICING',
                                        id: 'pric_2',
                                        name: 'Credit pack 50 000 per month',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    ],
} as unknown as PricingPlanSubscriptionExpanded;

/** Carries only the id of its method, which is all the API returns on the subscription. */
const subscriptionWithPaymentMethod = {
    ...mockSubscription,
    customer_id: 'cust_1',
    payment_method_id: 'pmet_1',
} as unknown as PricingPlanSubscriptionExpanded;

const cancelledSubscription = {
    ...mockSubscription,
    inactive_periods: [{ type: 'CANCEL', start_at: '2026-09-01T00:00:00Z' }],
} as unknown as PricingPlanSubscriptionExpanded;

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(SubscriptionCancellationModal, {
        props: {
            showModal: true,
            variant: 'CANCEL',
            subscription: mockSubscription,
            ...props,
        },
    });

describe('SubscriptionCancellationModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetSubscriptionCancellation.mockResolvedValue({ id: 'ppsu_1' });
    });

    describe('cancelling', () => {
        it('explains what cancelling does', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.modal__title').text()).toBe('Cancel subscription');
            expect(wrapper.find('.sv-subscription-cancellation-modal__explanation').text()).toBe(
                'Your subscription will be canceled, but you’ll continue to have access until 01/09/2026.',
            );
        });

        it('falls back to the vaguer copy when there is no next billing date', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithoutNextInvoice });

            expect(wrapper.find('.sv-subscription-cancellation-modal__explanation').text()).toBe(
                'Your subscription will be canceled, but you’ll continue to have access until the end of the billing period.',
            );
        });

        it('names the end of the billing period, not a pending cancellation date', () => {
            const wrapper = mountComponent({
                subscription: {
                    ...mockSubscription,
                    next_invoice: { invoice_date: '2026-09-01T00:00:00Z' },
                    inactive_periods: [{ type: 'CANCEL', start_at: '2027-01-01T00:00:00Z' }],
                },
            });

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__explanation').text(),
            ).toContain('01/09/2026');
        });

        it('summarises the subscription being given up', () => {
            const wrapper = mountComponent({
                subscription: subscriptionWithPaymentMethod,
                paymentMethod: mockPaymentMethod,
            });

            const summary = wrapper.find('.sv-subscription-cancellation-modal__subscription');

            expect(summary.exists()).toBe(true);
            expect(summary.text()).toContain('Pro plan');
            // Label and date are separate spans spaced by flex gap, so .text() runs them together.
            const renews = wrapper.find('.sv-subscription-cancellation-modal__renews').text();
            expect(renews).toContain('Renews');
            expect(renews).toContain('01/09/2026');
            expect(wrapper.find('.sv-subscription-cancellation-modal__payment-method').text()).toBe(
                '4242',
            );
        });

        it('still lets the customer cancel without a payment method to show', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithPaymentMethod });

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__payment-method').exists(),
            ).toBe(false);
            expect(wrapper.find('.modal__confirm').exists()).toBe(true);
        });

        it('shows the enabled pricing as the subline, the way the checkout does', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithPricings });
            const summary = wrapper
                .find('.sv-subscription-cancellation-modal__subscription')
                .text();

            expect(summary).toContain('Credit pack 10 000 per month');
            expect(summary).toContain('100,000 monthly credits');
            // Only the pricing actually enabled on the schedule, not every option in the group.
            expect(summary).not.toContain('Credit pack 50 000 per month');
        });

        it('names what is billed now, not a change that has yet to start', () => {
            const [current] = subscriptionWithPricings.pricing_plan_schedule_infos;
            const wrapper = mountComponent({
                subscription: {
                    ...subscriptionWithPricings,
                    pricing_plan_schedule_infos: [
                        current,
                        {
                            ...current,
                            id: 'ppsc_future',
                            start_at: '2999-01-01T00:00:00Z',
                            pricing_plan_schedule: {
                                type: 'DEFAULT',
                                enabled_pricings: [{ pricing_id: 'pric_2' }],
                            },
                        },
                    ],
                },
            });
            const summary = wrapper
                .find('.sv-subscription-cancellation-modal__subscription')
                .text();

            expect(summary).toContain('Credit pack 10 000 per month');
            expect(summary).not.toContain('Credit pack 50 000 per month');
        });

        it('leaves out the payment method when the subscription has none stored', () => {
            const wrapper = mountComponent();

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__payment-method').exists(),
            ).toBe(false);
            expect(wrapper.find('.sv-subscription-cancellation-modal__renews').exists()).toBe(true);
        });

        it('leaves out the renewal date when there is no next billing date', () => {
            const wrapper = mountComponent({ subscription: subscriptionWithoutNextInvoice });

            expect(wrapper.find('.sv-subscription-cancellation-modal__renews').exists()).toBe(
                false,
            );
        });

        it('names the action in the confirm button and dismisses by keeping the subscription', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.modal__confirm').text()).toBe('Cancel subscription');
            expect(wrapper.find('.modal__cancel').text()).toBe('Keep subscription');
        });

        it("dates the end of the billing period in the customer's timezone", () => {
            const wrapper = mountComponent({
                subscription: {
                    ...mockSubscription,
                    next_invoice: { invoice_date: '2026-09-01T02:00:00Z' },
                },
                customer: { id: 'cust_1', timezone: 'America/New_York' } as Customer,
            });

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__explanation').text(),
            ).toContain('31/08/2026');
            expect(wrapper.find('.sv-subscription-cancellation-modal__renews').text()).toContain(
                '31/08/2026',
            );
        });

        it('keeps its copy while it closes', async () => {
            const wrapper = mountComponent();

            await wrapper.setProps({ variant: undefined });

            expect(wrapper.find('.modal__title').text()).toBe('Cancel subscription');
            expect(wrapper.find('.modal__cancel').text()).toBe('Keep subscription');
        });

        it('cancels through the API when confirmed', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.modal__confirm').trigger('click');

            expect(mockSetSubscriptionCancellation).toHaveBeenCalledWith({
                id: 'ppsu_1',
                variant: 'CANCEL',
            });
        });

        it('reports the change and closes once the API accepts it', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.modal__confirm').trigger('click');
            await wrapper.vm.$nextTick();

            expect(wrapper.emitted('confirmed')).toHaveLength(1);
            expect(wrapper.emitted('close')).toHaveLength(1);
        });
    });

    describe('renewing', () => {
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('names the deadline for undoing the cancellation', () => {
            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: cancelledSubscription,
            });

            expect(wrapper.find('.modal__title').text()).toBe('Renew subscription');
            expect(wrapper.find('.sv-subscription-cancellation-modal__explanation').text()).toBe(
                'You can renew your subscription until 01/09/2026. After this period you can only create a new subscription.',
            );
        });

        it('dismisses with a plain "Cancel"', () => {
            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: cancelledSubscription,
            });

            expect(wrapper.find('.modal__confirm').text()).toBe('Renew subscription');
            expect(wrapper.find('.modal__cancel').text()).toBe('Cancel');
        });

        it('falls back to a dateless explanation when the subscription carries no period', () => {
            const wrapper = mountComponent({ variant: 'RENEW' });

            expect(wrapper.find('.sv-subscription-cancellation-modal__explanation').text()).toBe(
                'Your subscription will continue as before, and billing will resume on its usual schedule.',
            );
        });

        it('reads the date off the cancellation, not an upgrade that has ended', () => {
            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: {
                    ...mockSubscription,
                    inactive_periods: [
                        {
                            type: 'UPGRADE',
                            start_at: '2026-01-01T00:00:00Z',
                            end_at: '2026-02-01T00:00:00Z',
                        },
                        { type: 'CANCEL', start_at: '2026-09-01T00:00:00Z' },
                    ],
                },
            });

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__explanation').text(),
            ).toContain('01/09/2026');
        });

        it('names no deadline for a cancellation that cannot be undone any more', () => {
            vi.setSystemTime(new Date('2026-09-02T00:00:00Z'));

            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: cancelledSubscription,
            });

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__explanation').text(),
            ).not.toContain('01/09/2026');
        });

        it("dates the deadline in the customer's timezone", () => {
            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: {
                    ...mockSubscription,
                    inactive_periods: [{ type: 'CANCEL', start_at: '2026-09-01T02:00:00Z' }],
                },
                customer: { id: 'cust_1', timezone: 'America/New_York' } as Customer,
            });

            expect(
                wrapper.find('.sv-subscription-cancellation-modal__explanation').text(),
            ).toContain('31/08/2026');
        });

        it('keeps its copy while it closes', async () => {
            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: cancelledSubscription,
            });

            await wrapper.setProps({ variant: undefined });

            expect(wrapper.find('.modal__title').text()).toBe('Renew subscription');
            expect(wrapper.find('.modal__confirm').text()).toBe('Renew subscription');
        });

        it('renews through the API when confirmed', async () => {
            const wrapper = mountComponent({
                variant: 'RENEW',
                subscription: cancelledSubscription,
            });

            await wrapper.find('.modal__confirm').trigger('click');

            expect(mockSetSubscriptionCancellation).toHaveBeenCalledWith({
                id: 'ppsu_1',
                variant: 'RENEW',
            });
        });
    });

    describe('when the request fails', () => {
        beforeEach(() => {
            mockSetSubscriptionCancellation.mockRejectedValue(new Error('nope'));
        });

        it('shows the error and stays open', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.modal__confirm').trigger('click');
            await wrapper.vm.$nextTick();

            expect(wrapper.find('.sv-subscription-cancellation-modal__error').text()).toBe(
                'We could not cancel your subscription. Please try again.',
            );
            expect(wrapper.emitted('close')).toBeUndefined();
            expect(wrapper.emitted('confirmed')).toBeUndefined();
        });

        it('logs the failure', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.modal__confirm').trigger('click');
            await wrapper.vm.$nextTick();

            expect(mockLogError).toHaveBeenCalledWith(
                'SUBSCRIPTION_CANCELLATION_FAILED',
                expect.any(String),
                { variant: 'CANCEL' },
                expect.any(Error),
            );
        });

        it('clears the error when the modal is opened again', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.modal__confirm').trigger('click');
            await wrapper.vm.$nextTick();

            await wrapper.setProps({ showModal: false });
            await wrapper.setProps({ showModal: true });

            expect(wrapper.find('.sv-subscription-cancellation-modal__error').exists()).toBe(false);
        });
    });

    it('refuses to close while the request is still out', async () => {
        let resolveRequest: (value: unknown) => void = () => {};
        mockSetSubscriptionCancellation.mockReturnValue(
            new Promise((resolve) => {
                resolveRequest = resolve;
            }),
        );

        const wrapper = mountComponent();

        await wrapper.find('.modal__confirm').trigger('click');
        await wrapper.find('.modal__cancel').trigger('click');

        expect(wrapper.emitted('close')).toBeUndefined();
        expect(wrapper.find('.modal').attributes('data-loading')).toBe('true');

        resolveRequest({ id: 'ppsu_1' });
    });

    it('does not fire a second request while the first is out', async () => {
        mockSetSubscriptionCancellation.mockReturnValue(new Promise(() => {}));

        const wrapper = mountComponent();

        await wrapper.find('.modal__confirm').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');

        expect(mockSetSubscriptionCancellation).toHaveBeenCalledTimes(1);
    });
});

describe('SubscriptionCancellationModal dates the renewal the way the subscriptions list does', () => {
    const subscriptionWithInvoiceOn = (invoiceDate: string) =>
        ({
            id: 'ppsu_1',
            name: 'Pro plan',
            status: 'ACTIVE',
            next_invoice: { invoice_date: invoiceDate },
        }) as unknown as PricingPlanSubscriptionExpanded;

    const modalDate = (subscription: PricingPlanSubscriptionExpanded, customer: Customer) =>
        mount(SubscriptionCancellationModal, {
            props: { showModal: true, variant: 'CANCEL', subscription, customer },
        })
            .find('.sv-subscription-cancellation-modal__renews')
            .text()
            .replace(/^Renews\s*/, '');

    const listDate = (subscription: PricingPlanSubscriptionExpanded, customer: Customer) =>
        mount(SubscriptionsListItem, {
            props: { subscription, customer, paymentMethods: [] },
        })
            .find('.sv-subscriptions-list__item-next-invoice')
            .text()
            .replace(/^Next billing date\s*/, '');

    it.each([
        ['America/New_York', '2026-09-01T02:00:00Z', '31/08/2026'],
        ['Pacific/Auckland', '2026-08-31T13:00:00Z', '01/09/2026'],
        ['UTC', '2026-08-31T23:59:59Z', '31/08/2026'],
        ['Pacific/Auckland', '2026-08-31T23:59:59Z', '01/09/2026'],
    ])('%s at %s', (timezone, invoiceDate, expected) => {
        const subscription = subscriptionWithInvoiceOn(invoiceDate);
        const customer = { id: 'cust_1', timezone } as Customer;

        expect(modalDate(subscription, customer)).toBe(expected);
        expect(listDate(subscription, customer)).toBe(expected);
    });
});
