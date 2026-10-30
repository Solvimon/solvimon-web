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

    it('gives each config its own maximum, and fixes a config that cannot be changed', () => {
        const wrapper = mount(UnitsEditor, {
            props: {
                modelValue: [unit('pic_a', '4'), unit('pic_b', '1')],
                maxValues: [unit('pic_a', '9')],
                editableConfigIds: ['pic_a'],
                pricings: [],
            },
            global: { stubs: { UnitsEditorItem: true } },
        });

        const items = wrapper.findAllComponents(UnitsEditorItem);

        expect(items.map((item) => item.props('maxValue'))).toEqual([
            unit('pic_a', '9'),
            undefined,
        ]);
        expect(items.map((item) => item.props('disabled'))).toEqual([false, true]);
    });

    it('lets every config be changed when no editable configs are given', () => {
        const wrapper = mount(UnitsEditor, {
            props: { modelValue: [unit('pic_a', '4')], pricings: [] },
            global: { stubs: { UnitsEditorItem: true } },
        });

        expect(wrapper.findComponent(UnitsEditorItem).props()).toMatchObject({
            maxValue: undefined,
            disabled: false,
        });
    });

    describe('typing a quantity', () => {
        const mountBound = (props: Record<string, unknown>) => {
            const wrapper = mount(UnitsEditor, {
                props: {
                    pricings: [],
                    'onUpdate:modelValue': (modelValue: ConfiguredMeterValue[]) =>
                        wrapper.setProps({ modelValue }),
                    ...props,
                } as never,
            });
            return wrapper;
        };

        it('takes a fraction for a config whose range has one', async () => {
            const wrapper = mountBound({
                modelValue: [unit('pic_a', '1.5')],
                initialUnitsValues: [unit('pic_a', '0.5')],
                maxValues: [unit('pic_a', '4')],
            });
            const field = wrapper.find('input[type="number"]');

            expect(field.attributes()).toMatchObject({ step: 'any', min: '0.5', max: '4' });
            await field.setValue('2.5');

            expect(wrapper.props('modelValue')).toStrictEqual([unit('pic_a', '2.5')]);
        });

        it('lowers a typed quantity above the maximum to it, on screen as well', async () => {
            const wrapper = mountBound({
                modelValue: [unit('pic_a', '1.5')],
                maxValues: [unit('pic_a', '4')],
            });

            await wrapper.find('input[type="number"]').setValue('50');

            expect(wrapper.props('modelValue')).toStrictEqual([unit('pic_a', '4')]);
            expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe(
                '4',
            );
        });

        it('keeps the stepper, and takes any count, for a config without a maximum', async () => {
            const wrapper = mountBound({ modelValue: [unit('pic_a', '1.5')] });

            expect(wrapper.find('input[step="any"]').exists()).toBe(false);
            wrapper.findComponent({ name: 'StepInput' }).vm.$emit('update:modelValue', 50);
            await wrapper.vm.$nextTick();

            expect(wrapper.props('modelValue')).toStrictEqual([unit('pic_a', '50')]);
        });
    });
});
