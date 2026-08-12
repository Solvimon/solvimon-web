import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
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
                    h('div', { class: 'sv-pricing-plan-schedules-stub' }, String(props.schedules.length));
            },
        }),
    });
});

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
}));

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

        it('dispatches the cancel subscription action when clicked', async () => {
            const wrapper = mountComponent();

            await wrapper.find('.sv-subscription-details__cancel').trigger('click');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'cancel-subscription',
                data: { subscriptionId: 'ppsu_1' },
            });
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

        it('dispatches the renew subscription action when clicked', async () => {
            const wrapper = mountComponent({
                subscription: { ...mockSubscription, inactive_periods: [{}] },
            });

            await wrapper.find('.sv-subscription-details__renew').trigger('click');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'renew-subscription',
                data: { subscriptionId: 'ppsu_1' },
            });
        });
    });
});
