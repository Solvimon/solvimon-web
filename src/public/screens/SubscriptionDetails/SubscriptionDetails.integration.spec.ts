import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import SubscriptionDetails from './SubscriptionDetails.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // ErrorNotification resolves its own IntlProvider internally, which is not mounted here.
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup(props) {
                return () => h('div', { class: 'sv-error-notification-stub' }, props.title);
            },
        }),
        // PricingPlanSchedules resolves its own IntlProvider too.
        PricingPlanSchedules: defineComponent({
            name: 'PricingPlanSchedulesStub',
            props: { schedules: { type: Array, required: true } },
            setup(props) {
                return () =>
                    h(
                        'div',
                        { class: 'sv-pricing-plan-schedules-stub' },
                        String(props.schedules.length),
                    );
            },
        }),
        WalletBalances: defineComponent({
            name: 'WalletBalancesStub',
            props: {
                customerWalletBalances: { type: Array, required: true },
                title: String,
                showTopUpButton: Boolean,
            },
            setup(props) {
                return () =>
                    h(
                        'div',
                        { class: 'sv-wallet-balances-stub' },
                        String(props.customerWalletBalances.length),
                    );
            },
        }),
    });
});

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
}));

// The real modal builds its own request services, which need providers this mount does not have.
vi.mock('@/components/wallets/TopUpModal/TopUpModal.vue', () => ({
    default: defineComponent({
        name: 'TopUpModalStub',
        props: { showModal: Boolean, selectedBalanceItem: Object },
        emits: ['close', 'confirm', 'payment-success'],
        setup(props) {
            return () =>
                h('div', {
                    class: 'sv-top-up-modal-stub',
                    'data-open': String(props.showModal),
                });
        },
    }),
}));

// Builds a subscriptions service of its own, which needs providers this mount does not have.
vi.mock(
    '@/components/subscriptions/SubscriptionCancellationModal/SubscriptionCancellationModal.vue',
    () => ({
        default: defineComponent({
            name: 'SubscriptionCancellationModalStub',
            props: { showModal: Boolean, variant: String, subscription: Object },
            emits: ['close', 'confirmed'],
            setup(props) {
                return () =>
                    h('div', {
                        class: 'sv-subscription-cancellation-modal-stub',
                        'data-open': String(props.showModal),
                        'data-variant': props.variant ?? '',
                    });
            },
        }),
    }),
);

const mockWalletBalance = {
    wallet_id: 'w_1',
    wallet_balance: {
        open_balance: { currency: 'EUR', quantity: '100' },
    },
} as unknown as CustomerWalletBalanceItem;

const mockSubscription = {
    id: 'ppsu_1',
    name: 'Pro plan',
    pricing_plan_schedule_infos: [
        {
            id: 'ppsc_1',
            pricing_plan_schedule: { id: 'ppsc_1', type: 'DEFAULT' },
            pricing_plan_version: { pricing_plan: { name: 'Pro plan' } },
        },
    ],
} as unknown as PricingPlanSubscriptionExpanded;

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(SubscriptionDetails, {
        props: { isLoading: false, subscription: mockSubscription, ...props },
    });

describe('SubscriptionDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the subscription summary once loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-details__summary').exists()).toBe(true);
        expect(wrapper.text()).toContain('Pro plan');
    });

    it('renders a skeleton while loading', () => {
        const wrapper = mountComponent({ isLoading: true, subscription: undefined });

        expect(wrapper.find('.sv-skeleton').exists()).toBe(true);
        expect(wrapper.find('.sv-subscription-details__summary').exists()).toBe(false);
    });

    it('renders an error over the empty state when loading failed', () => {
        const wrapper = mountComponent({
            subscription: undefined,
            error: new Error('nope'),
        });

        expect(wrapper.find('.sv-subscription-details__error').exists()).toBe(true);
        expect(wrapper.find('.sv-subscription-details__empty-state').exists()).toBe(false);
    });

    it('renders the empty state when the subscription does not exist', () => {
        const wrapper = mountComponent({ subscription: undefined });

        expect(wrapper.find('.sv-subscription-details__empty-state').exists()).toBe(true);
        expect(wrapper.text()).toContain('Subscription not found');
    });

    it('renders the schedules as the main content', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-details__schedules').exists()).toBe(true);
    });

    describe('title', () => {
        it('is the subscription name', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-subscription-details__title').text()).toBe('Pro plan');
        });

        it('falls back to the pricing plan name when the subscription has none', () => {
            const wrapper = mountComponent({
                subscription: { ...mockSubscription, name: undefined },
            });

            expect(wrapper.find('.sv-subscription-details__title').text()).toBe('Pro plan');
        });

        it('falls back to the generic screen title while there is no subscription', () => {
            const wrapper = mountComponent({ isLoading: true, subscription: undefined });

            expect(wrapper.find('.sv-subscription-details__title').text()).toBe(
                'Subscription details',
            );
        });
    });

    describe('cancel subscription button', () => {
        it('is rendered when the subscription is cancellable', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-subscription-details__cancel').text()).toBe(
                'Cancel subscription',
            );
        });

        it('is not rendered when the subscription is already cancelled', () => {
            const wrapper = mountComponent({
                subscription: { ...mockSubscription, inactive_periods: [{}] },
            });

            expect(wrapper.find('.sv-subscription-details__cancel').exists()).toBe(false);
        });

        it('opens the cancellation modal when clicked, rather than handing it to the host', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-subscription-details__cancel').trigger('click');

            const modal = wrapper.find('.sv-subscription-cancellation-modal-stub');
            expect(modal.attributes('data-open')).toBe('true');
            expect(modal.attributes('data-variant')).toBe('CANCEL');
            expect(mockDispatchAction).not.toHaveBeenCalled();
        });

        it('keeps the modal closed until a button is used', () => {
            const wrapper = mountComponent();

            expect(
                wrapper.find('.sv-subscription-cancellation-modal-stub').attributes('data-open'),
            ).toBe('false');
        });

        it('asks the host to refetch once the cancellation is confirmed', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-subscription-details__cancel').trigger('click');
            wrapper
                .findComponent({ name: 'SubscriptionCancellationModalStub' })
                .vm.$emit('confirmed');

            expect(wrapper.emitted('subscription-changed')).toHaveLength(1);
        });

        it('confirms the cancellation on screen', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-subscription-details__cancel').trigger('click');
            wrapper
                .findComponent({ name: 'SubscriptionCancellationModalStub' })
                .vm.$emit('confirmed');
            await wrapper.vm.$nextTick();

            expect(wrapper.find('.sv-subscription-details__cancellation-success').exists()).toBe(
                true,
            );
        });

        it('closes the modal when it is dismissed', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-subscription-details__cancel').trigger('click');
            wrapper.findComponent({ name: 'SubscriptionCancellationModalStub' }).vm.$emit('close');
            await wrapper.vm.$nextTick();

            expect(
                wrapper.find('.sv-subscription-cancellation-modal-stub').attributes('data-open'),
            ).toBe('false');
            expect(wrapper.emitted('subscription-changed')).toBeUndefined();
        });
    });

    describe('upgrades', () => {
        const withUpgrade = {
            ...mockSubscription,
            pricing_plan_schedule_infos: [
                {
                    id: 'ppsc_1',
                    pricing_plan_schedule: {
                        id: 'ppsc_1',
                        enabled_pricings: [{ pricing_id: 'pri_1' }],
                    },
                    pricing_plan_version: {
                        pricing_plan: { name: 'Pro plan' },
                        pricing_categories: [
                            {
                                pricing_groups: [
                                    {
                                        id: 'pgr_1',
                                        name: 'Credit packs',
                                        pricings: [{ id: 'pri_1', name: '1.000 credits' }],
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        it('lists the pricings enabled on the current schedule', () => {
            const wrapper = mountComponent({ subscription: withUpgrade });

            expect(wrapper.find('.sv-enabled-pricings-list__item-name').text()).toBe(
                '1.000 credits',
            );
        });

        it('renders no upgrades block when the schedule has none enabled', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-enabled-pricings-list').exists()).toBe(false);
        });

        it('hands an upgrade off to the host', async () => {
            const wrapper = mountComponent({ subscription: withUpgrade });

            await wrapper.find('.sv-enabled-pricings-list__item-upgrade').trigger('click');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'manage-subscription',
                data: { subscriptionId: 'ppsu_1' },
            });
        });
    });

    describe('wallets', () => {
        it('renders the wallet balances in the aside', () => {
            const wrapper = mountComponent({ walletBalances: [mockWalletBalance] });

            expect(wrapper.find('.sv-subscription-details__wallet-balances').exists()).toBe(true);
            expect(wrapper.find('.sv-wallet-balances-stub').text()).toBe('1');
        });

        it('reports the wallet balances failing to load', () => {
            const wrapper = mountComponent({
                walletBalances: [mockWalletBalance],
                hasWalletBalancesError: true,
            });

            expect(wrapper.find('.sv-wallet-balances-stub').exists()).toBe(false);
            expect(wrapper.find('.sv-wallet-balances.sv-error').exists()).toBe(true);
        });

        it('keeps the top-up modal closed until a wallet is picked', () => {
            const wrapper = mountComponent({ walletBalances: [mockWalletBalance] });

            expect(wrapper.find('.sv-top-up-modal-stub').attributes('data-open')).toBe('false');
        });

        it('opens the top-up modal for the wallet that asked for it', async () => {
            const wrapper = mountComponent({ walletBalances: [mockWalletBalance] });

            wrapper
                .findComponent({ name: 'CustomerWalletBalances' })
                .vm.$emit('top-up', mockWalletBalance);
            await wrapper.vm.$nextTick();

            const modal = wrapper.findComponent({ name: 'TopUpModalStub' });

            expect(modal.attributes('data-open')).toBe('true');
            expect(modal.props('selectedBalanceItem')).toEqual(mockWalletBalance);
        });

        it('reports a charged top-up so the balance can be reloaded', () => {
            const wrapper = mountComponent({ walletBalances: [mockWalletBalance] });

            wrapper.findComponent({ name: 'TopUpModalStub' }).vm.$emit('confirm');

            expect(wrapper.emitted('top-up-charged')).toHaveLength(1);
        });

        it('reports a stored payment method so the list can be reloaded', () => {
            const wrapper = mountComponent({ walletBalances: [mockWalletBalance] });

            wrapper.findComponent({ name: 'TopUpModalStub' }).vm.$emit('payment-success');

            expect(wrapper.emitted('payment-method-stored')).toHaveLength(1);
        });
    });

    describe('renew subscription button', () => {
        it('is rendered when the subscription is cancelled', () => {
            const wrapper = mountComponent({
                subscription: { ...mockSubscription, inactive_periods: [{}] },
            });

            expect(wrapper.find('.sv-subscription-details__renew').text()).toBe(
                'Renew subscription',
            );
        });

        it('is not rendered when the subscription is still active', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-subscription-details__renew').exists()).toBe(false);
        });

        it('opens the renewal modal when clicked, rather than handing it to the host', async () => {
            const wrapper = mountComponent({
                subscription: { ...mockSubscription, inactive_periods: [{}] },
            });

            await wrapper.find('.sv-subscription-details__renew').trigger('click');

            const modal = wrapper.find('.sv-subscription-cancellation-modal-stub');
            expect(modal.attributes('data-open')).toBe('true');
            expect(modal.attributes('data-variant')).toBe('RENEW');
            expect(mockDispatchAction).not.toHaveBeenCalled();
        });

        it('asks the host to refetch once the renewal is confirmed', async () => {
            const wrapper = mountComponent({
                subscription: { ...mockSubscription, inactive_periods: [{}] },
            });

            await wrapper.find('.sv-subscription-details__renew').trigger('click');
            wrapper
                .findComponent({ name: 'SubscriptionCancellationModalStub' })
                .vm.$emit('confirmed');

            expect(wrapper.emitted('subscription-changed')).toHaveLength(1);
        });
    });
});
