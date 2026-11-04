import { mount } from '@vue/test-utils';
import type { PricingExtended } from '@solvimon/solvimon-types';
import { Button, StepInput } from '@solvimon/solvimon-ui';
import AddonMultipleEditor from './AddonMultipleEditor.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

vi.mock('./usePricingDescription', () => ({
    usePricingDescription: () => ({ describePricing: () => '' }),
}));

const seatAddon = {
    id: 'pric_seats',
    product_type: 'ADDON',
    products: [{ name: 'Extra seats' }],
    items: [
        {
            id: 'prii_seats',
            product_items: [{ name: 'Seat', model_type: 'PER_SEAT' }],
            configs: [
                {
                    id: 'pico_seats',
                    details: { pricing_type: 'FLAT', bands: [] },
                    default_seats_value: { number: '3' },
                },
            ],
        },
    ],
} as unknown as PricingExtended;

const mountEditor = (props: { modelValue?: string[] } = {}) => {
    // An add-on in the order without seats is filled in while mounting, before `wrapper` is set.
    let wrapper: ReturnType<typeof mount<typeof AddonMultipleEditor>> | undefined = undefined;
    wrapper = mount(AddonMultipleEditor, {
        props: {
            pricings: [seatAddon],
            billingPeriod: { type: 'MONTH' as const, value: 1 },
            currency: 'EUR',
            modelValue: [],
            seatsValues: [],
            quantityPricingIds: ['pric_seats'],
            'onUpdate:modelValue': (value: string[]) => wrapper?.setProps({ modelValue: value }),
            'onUpdate:seatsValues': (value) => wrapper?.setProps({ seatsValues: value }),
            ...props,
        },
    });
    return wrapper;
};

describe('AddonMultipleEditor', () => {
    it('adds a seat-based add-on at its default seats and shows a seats input', async () => {
        const wrapper = mountEditor();

        await wrapper.findComponent(Button).trigger('click');

        expect(wrapper.props('modelValue')).toEqual(['pric_seats']);
        expect(wrapper.props('seatsValues')).toEqual([
            { pricing_item_config_id: 'pico_seats', number: '3' },
        ]);
        expect(wrapper.findComponent(StepInput).props('modelValue')).toBe(3);
    });

    it('removes the add-on and shows the add button again from the seats input', async () => {
        const wrapper = mountEditor();
        await wrapper.findComponent(Button).trigger('click');

        expect(wrapper.findComponent(StepInput).props()).toMatchObject({ min: 3, removable: true });
        wrapper.findComponent(StepInput).vm.$emit('remove');
        await wrapper.vm.$nextTick();

        expect(wrapper.props('modelValue')).toEqual([]);
        expect(wrapper.props('seatsValues')).toEqual([]);
        expect(wrapper.findComponent(StepInput).exists()).toBe(false);
        expect(wrapper.findComponent(Button).exists()).toBe(true);
    });

    it('gives an add-on in the order without seats its default seats', async () => {
        const wrapper = mountEditor({ modelValue: ['pric_seats'] });

        expect(wrapper.emitted('update:seatsValues')?.at(-1)).toEqual([
            [{ pricing_item_config_id: 'pico_seats', number: '3' }],
        ]);
    });

    it('keeps the add-on while a number below its default seats is being typed', async () => {
        const wrapper = mountEditor();
        await wrapper.findComponent(Button).trigger('click');

        wrapper.findComponent(StepInput).vm.$emit('update:modelValue', 1);
        await wrapper.vm.$nextTick();

        expect(wrapper.props('modelValue')).toEqual(['pric_seats']);
        expect(wrapper.props('seatsValues')).toEqual([
            { pricing_item_config_id: 'pico_seats', number: '3' },
        ]);
    });
});
