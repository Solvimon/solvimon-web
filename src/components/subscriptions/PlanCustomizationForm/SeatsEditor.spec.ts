import { mount } from '@vue/test-utils';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import SeatsEditor from './SeatsEditor.vue';
import SeatsEditorItem from './SeatsEditorItem.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const seat = (id: string, number: string): ConfiguredMeterValue => ({
    pricing_item_config_id: id,
    number,
});

describe('SeatsEditor', () => {
    // A form restored after a payment redirect need not list its seats in the order's order.
    it('bounds each seat count by its own config in the order, whatever its position', () => {
        const wrapper = mount(SeatsEditor, {
            props: {
                modelValue: [seat('pic_b', '4'), seat('pic_a', '9')],
                initialSeatsValues: [seat('pic_a', '5'), seat('pic_b', '1')],
                pricings: [],
            },
            global: { stubs: { SeatsEditorItem: true } },
        });

        const defaults = wrapper
            .findAllComponents(SeatsEditorItem)
            .map((item) => item.props('defaultValue'));

        expect(defaults).toEqual([seat('pic_b', '1'), seat('pic_a', '5')]);
    });
});
