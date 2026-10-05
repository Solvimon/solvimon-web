import { mount } from '@vue/test-utils';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import OnDemandItemsCard from './OnDemandItemsCard.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const items: ChargeOnDemandItem[] = [
    {
        pricingItemId: 'prii_fixed',
        pricingItemConfigId: 'pico_fixed',
        name: 'On-demand fixed fee',
        priceType: 'FIXED',
        price: { quantity: '500', currency: 'EUR' },
        defaultUnits: 1,
    },
    {
        pricingItemId: 'prii_flat',
        pricingItemConfigId: 'pico_flat',
        name: 'On-demand per-unit fee',
        priceType: 'FLAT',
        price: { quantity: '100', currency: 'EUR' },
        defaultUnits: 4,
    },
];

const buildItems = (count: number): ChargeOnDemandItem[] =>
    Array.from({ length: count }, (_, index) => ({
        pricingItemId: `prii_${index}`,
        pricingItemConfigId: `pico_${index}`,
        name: `Item ${index + 1}`,
        priceType: 'FIXED',
        price: { quantity: '100', currency: 'EUR' },
        defaultUnits: 1,
    }));

describe('OnDemandItemsCard', () => {
    it('lists the items that can be ordered with their price', () => {
        const rows = mount(OnDemandItemsCard, { props: { items } }).findAll(
            '.sv-on-demand-items-card__item',
        );

        expect(rows).toHaveLength(2);
        expect(rows[0]?.text()).toContain('On-demand fixed fee');
        expect(rows[0]?.text()).toContain('one-off');
        expect(rows[1]?.text()).toContain('On-demand per-unit fee');
        expect(rows[1]?.text()).toContain('per unit');
    });

    it('lists the first two items and how many more are available', () => {
        const wrapper = mount(OnDemandItemsCard, { props: { items: buildItems(12) } });
        const rows = wrapper.findAll('.sv-on-demand-items-card__item');

        expect(rows.map((row) => row.text())).toEqual([
            expect.stringContaining('Item 1'),
            expect.stringContaining('Item 2'),
        ]);
        expect(wrapper.find('.sv-on-demand-items-card__more').text()).toBe('+ 10 available');
    });

    it.each([1, 2])('does not count more items when there are %i', (count) => {
        const wrapper = mount(OnDemandItemsCard, { props: { items: buildItems(count) } });

        expect(wrapper.findAll('.sv-on-demand-items-card__item')).toHaveLength(count);
        expect(wrapper.find('.sv-on-demand-items-card__more').exists()).toBe(false);
    });

    it('asks to open the order form', async () => {
        const wrapper = mount(OnDemandItemsCard, { props: { items } });

        await wrapper.find('.sv-on-demand-items-card__order').trigger('click');

        expect(wrapper.emitted('order')).toHaveLength(1);
    });
});
