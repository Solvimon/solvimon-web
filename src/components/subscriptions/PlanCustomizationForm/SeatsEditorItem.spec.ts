import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SeatsEditorItem from './SeatsEditorItem.vue';

const { seats } = vi.hoisted(() => ({ seats: { value: undefined as unknown } }));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({ useTimePeriod: () => ({ formatTimePeriod: () => 'month' }) });
});

vi.mock('@/composables/useSeatBasedPricing', () => ({
    useSeatBasedPricing: () => ref(seats.value),
}));

const mountItem = () =>
    mount(SeatsEditorItem, {
        props: {
            modelValue: { pricing_item_config_id: 'pic_1', number: '2' },
            pricings: [],
        },
        global: { stubs: { TieredTable: true, StepInput: true } },
    });

describe('SeatsEditorItem', () => {
    // A div with a click handler could be reached by Tab, but not opened by Enter or announced.
    it('opens the tiers with a button that says whether they are open', async () => {
        seats.value = {
            product: { name: 'Seats' },
            pricing: { tiered: { bands: [{ amount: { quantity: '1', currency: 'EUR' } }] } },
            billing: {},
        };
        const wrapper = mountItem();
        const toggle = wrapper.find('button');

        expect(toggle.attributes('aria-expanded')).toBe('false');
        await toggle.trigger('click');
        expect(toggle.attributes('aria-expanded')).toBe('true');
        expect(wrapper.findComponent({ name: 'TieredTable' }).exists()).toBe(true);
    });

    it('offers nothing to open for a flat price per seat', () => {
        seats.value = {
            product: { name: 'Seats' },
            pricing: { amount: { quantity: '10', currency: 'EUR' } },
            billing: {},
        };

        expect(mountItem().find('button').exists()).toBe(false);
    });
});
