import { mount } from '@vue/test-utils';
import OnDemandItemsCard from './OnDemandItemsCard.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

describe('OnDemandItemsCard', () => {
    it('asks to open the order form', async () => {
        const wrapper = mount(OnDemandItemsCard);

        await wrapper.find('.sv-on-demand-items-card__order').trigger('click');

        expect(wrapper.emitted('order')).toHaveLength(1);
    });
});
