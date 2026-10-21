import { mount } from '@vue/test-utils';
import { StepInput } from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/solvimon-types';
import PricingGroupSeatsEditor from './PricingGroupSeatsEditor.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // The real one resolves an IntlProvider, which is not mounted here.
        useTimePeriod: () => ({
            formatTimePeriod: ({ type }: { type: string }) => type.toLowerCase(),
        }),
    });
});

const seatPricing = (id: string, amount: string): PricingExtended =>
    ({
        object_type: 'PRICING',
        id,
        name: `${id} server`,
        pricing_group_id: 'server-type',
        product_type: 'ADDON',
        product_ids: [],
        items: [
            {
                id: `${id}-item`,
                product_item_ids: [],
                configs: [
                    {
                        object_type: 'PRICING_ITEM_CONFIG',
                        id: `${id}-config`,
                        order: 1,
                        billing_in_advance: true,
                        details: {
                            pricing_type: 'FLAT',
                            bands: [{ amount: { quantity: amount, currency: 'EUR' } }],
                        },
                    },
                ],
            },
        ],
    }) as PricingExtended;

const pricings = [seatPricing('b100', '45000'), seatPricing('h200', '50000')];

const mountEditor = ({
    enabledPricingIds,
    seatsValues,
}: {
    enabledPricingIds: string[];
    seatsValues: ConfiguredMeterValue[];
}) =>
    mount(PricingGroupSeatsEditor, {
        props: {
            groupName: 'Server type',
            pricings,
            billingPeriod: { type: 'MONTH', value: 1 },
            currency: 'EUR',
            modelValue: enabledPricingIds,
            seatsValues,
            seatConfigIdByPricingId: new Map([
                ['b100', 'b100-config'],
                ['h200', 'h200-config'],
            ]),
            initialSeatsValues: [
                { pricing_item_config_id: 'b100-config', number: '1' },
                { pricing_item_config_id: 'h200-config', number: '1' },
            ],
        },
    });

describe('PricingGroupSeatsEditor', () => {
    it('counts the seats of the picked option and none of the others', () => {
        const wrapper = mountEditor({
            enabledPricingIds: ['b100'],
            seatsValues: [{ pricing_item_config_id: 'b100-config', number: '3' }],
        });

        const steppers = wrapper.findAllComponents(StepInput);

        expect(steppers.map((stepper) => stepper.props('modelValue'))).toEqual([3, 0]);
        expect(steppers.map((stepper) => stepper.props('disabled'))).toEqual([false, true]);
        expect(
            wrapper.findAll('[role="radio"]').map((radio) => radio.attributes('aria-checked')),
        ).toEqual(['true', 'false']);
    });

    it('shows each option at its price per seat', () => {
        const wrapper = mountEditor({ enabledPricingIds: ['b100'], seatsValues: [] });

        const text = wrapper.text();
        expect(text).toContain('b100 server');
        expect(text).toContain('per seat/month');
        expect(text).toMatch(/45,000\.00/);
        expect(text).toMatch(/50,000\.00/);
    });

    it('picks an option when it is clicked, in place of the one picked before', async () => {
        const wrapper = mountEditor({
            enabledPricingIds: ['other-group-pricing', 'b100'],
            seatsValues: [{ pricing_item_config_id: 'b100-config', number: '3' }],
        });

        await wrapper.findAll('[role="radio"]')[1].trigger('click');

        expect(wrapper.emitted('update:modelValue')).toEqual([[['other-group-pricing', 'h200']]]);
    });

    it('picks an option from the keyboard', async () => {
        const wrapper = mountEditor({ enabledPricingIds: ['b100'], seatsValues: [] });

        await wrapper.findAll('[role="radio"]')[1].trigger('keydown', { key: 'Enter' });

        expect(wrapper.emitted('update:modelValue')).toEqual([[['h200']]]);
    });

    it('changes the seats of the picked option only', () => {
        const wrapper = mountEditor({
            enabledPricingIds: ['b100'],
            seatsValues: [
                { pricing_item_config_id: 'b100-config', number: '3' },
                { pricing_item_config_id: 'base-config', number: '2' },
            ],
        });

        wrapper.findAllComponents(StepInput)[0].vm.$emit('update:modelValue', 4);

        expect(wrapper.emitted('update:seatsValues')).toEqual([
            [
                [
                    { pricing_item_config_id: 'b100-config', number: '4' },
                    { pricing_item_config_id: 'base-config', number: '2' },
                ],
            ],
        ]);
    });
});
