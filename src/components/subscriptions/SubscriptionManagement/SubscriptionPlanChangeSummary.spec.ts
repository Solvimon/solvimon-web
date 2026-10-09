import { mount } from '@vue/test-utils';
import SubscriptionPlanChangeSummary from './SubscriptionPlanChangeSummary.vue';
import type { PricingPlanGroupChangeType } from '@/types/pricingPlanGroup';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const mountComponent = (
    props: { planName?: string; changeType?: PricingPlanGroupChangeType } = {},
) =>
    mount(SubscriptionPlanChangeSummary, {
        props: { planName: 'Pro', ...props },
    });

describe('SubscriptionPlanChangeSummary', () => {
    it('names the plan the subscription is moving to', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-plan-change-summary__headline').text()).toBe(
            'Moving to Pro',
        );
    });

    it('promises an immediate move for an immediate transition', () => {
        const wrapper = mountComponent({ changeType: 'IMMEDIATE_PRO_RATA' });

        expect(wrapper.find('.sv-subscription-plan-change-summary__timing').text()).toContain(
            'takes effect right away',
        );
    });

    it('promises the next billing period when the group times the move that way', () => {
        const wrapper = mountComponent({ changeType: 'NEXT_BILLING_PERIOD' });

        expect(wrapper.find('.sv-subscription-plan-change-summary__timing').text()).toContain(
            'at the start of your next billing period',
        );
    });
});
