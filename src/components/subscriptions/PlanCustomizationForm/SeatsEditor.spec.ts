import { flushPromises, mount } from '@vue/test-utils';
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

    it('gives each config its own maximum, and fixes a config that cannot be changed', () => {
        const wrapper = mount(SeatsEditor, {
            props: {
                modelValue: [seat('pic_a', '4'), seat('pic_b', '1')],
                maxValues: [seat('pic_a', '9')],
                editableConfigIds: ['pic_a'],
                pricings: [],
            },
            global: { stubs: { SeatsEditorItem: true } },
        });

        const items = wrapper.findAllComponents(SeatsEditorItem);

        expect(items.map((item) => item.props('maxValue'))).toEqual([
            seat('pic_a', '9'),
            undefined,
        ]);
        expect(items.map((item) => item.props('disabled'))).toEqual([false, true]);
    });

    it('lets every config be changed when no editable configs are given', () => {
        const wrapper = mount(SeatsEditor, {
            props: { modelValue: [seat('pic_a', '4')], pricings: [] },
            global: { stubs: { SeatsEditorItem: true } },
        });

        expect(wrapper.findComponent(SeatsEditorItem).props()).toMatchObject({
            maxValue: undefined,
            disabled: false,
        });
    });

    it('lowers a typed seat count above the maximum to it, on screen as well', async () => {
        const wrapper = mount(SeatsEditor, {
            props: {
                modelValue: [seat('pic_a', '10')],
                maxValues: [seat('pic_a', '10')],
                pricings: [],
                'onUpdate:modelValue': (modelValue: ConfiguredMeterValue[]) =>
                    wrapper.setProps({ modelValue }),
            } as never,
        });
        const typed = () => wrapper.find('[contenteditable]').element as HTMLElement;

        typed().innerText = '50';
        await wrapper.find('[contenteditable]').trigger('input');
        await flushPromises();

        expect(wrapper.props('modelValue')).toStrictEqual([seat('pic_a', '10')]);
        expect(typed().innerText).toBe('10');
    });
});
