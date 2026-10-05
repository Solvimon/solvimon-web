import { mount } from '@vue/test-utils';
import OnDemandItemsCard from './OnDemandItemsCard.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const subscription = {
    id: 'ppsu_1',
    name: 'Pro plan',
    pricing_plan_schedule_infos: [],
} as unknown as PricingPlanSubscriptionExpanded;

describe('OnDemandItemsCard', () => {
    it('names the subscription the items are bought in', () => {
        const wrapper = mount(OnDemandItemsCard, { props: { subscription } });

        expect(wrapper.find('.sv-on-demand-items-card__description').text()).toContain('Pro plan');
    });

    it('asks to open the order form', async () => {
        const wrapper = mount(OnDemandItemsCard, { props: { subscription } });

        await wrapper.find('.sv-on-demand-items-card__order').trigger('click');

        expect(wrapper.emitted('order')).toHaveLength(1);
    });
});
