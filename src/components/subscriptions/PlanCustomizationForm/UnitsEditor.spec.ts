import { mount } from '@vue/test-utils';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import UnitsEditor from './UnitsEditor.vue';
import UnitsEditorItem from './UnitsEditorItem.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const unit = (id: string, number: string): ConfiguredMeterValue => ({
    pricing_item_config_id: id,
    number,
});

describe('UnitsEditor', () => {
    // A form restored after a payment redirect need not list its units in the order's order.
    it('bounds each unit quantity by its own config in the order, whatever its position', () => {
        const wrapper = mount(UnitsEditor, {
            props: {
                modelValue: [unit('pic_b', '4'), unit('pic_a', '9')],
                initialUnitsValues: [unit('pic_a', '5'), unit('pic_b', '1')],
                pricings: [],
            },
            global: { stubs: { UnitsEditorItem: true } },
        });

        const defaults = wrapper
            .findAllComponents(UnitsEditorItem)
            .map((item) => item.props('defaultValue'));

        expect(defaults).toEqual([unit('pic_b', '1'), unit('pic_a', '5')]);
    });
});
