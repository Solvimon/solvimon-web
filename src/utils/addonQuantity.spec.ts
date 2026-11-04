import type { PricingExtended } from '@solvimon/solvimon-types';
import {
    getAddonConfigIds,
    getAddonMinimumQuantity,
    getAddonQuantity,
    isQuantityAddon,
    setAddonQuantity,
    type AddonSelection,
} from './addonQuantity';

const item = (
    modelType: string,
    configs: { id: string; pricingType: string; defaultNumber?: string }[],
) => ({
    object_type: 'PRICING_ITEM',
    id: `prii_${configs[0]!.id}`,
    product_items: [{ model_type: modelType }],
    configs: configs.map(({ id, pricingType, defaultNumber }) => ({
        id,
        details: { pricing_type: pricingType },
        ...(defaultNumber && {
            default_seats_value: { number: defaultNumber },
            default_units: { number: defaultNumber },
        }),
    })),
});

const terminalAddon = {
    id: 'pric_terminal',
    product_type: 'ADDON',
    items: [
        item('ONE_OFF', [{ id: 'pico_terminal', pricingType: 'FLAT' }]),
        item('USAGE_BASED', [{ id: 'pico_service', pricingType: 'TOP_TIERED' }]),
    ],
} as unknown as PricingExtended;

const seatAddon = {
    id: 'pric_seats',
    product_type: 'ADDON',
    items: [
        item('PER_SEAT', [
            { id: 'pico_seat_eur', pricingType: 'FLAT' },
            { id: 'pico_seat_usd', pricingType: 'FLAT' },
        ]),
    ],
} as unknown as PricingExtended;

const toggleAddon = {
    id: 'pric_toggle',
    product_type: 'ADDON',
    items: [item('RECURRING', [{ id: 'pico_toggle', pricingType: 'FLAT' }])],
} as unknown as PricingExtended;

const planSeat = { pricing_item_config_id: 'pico_plan_seat', number: '3' };
const empty: AddonSelection = { enabledPricingIds: [], seatsValues: [], unitsValues: [] };

describe('isQuantityAddon', () => {
    it('takes a quantity for a per-seat or a one-off flat item', () => {
        expect(isQuantityAddon(seatAddon)).toBe(true);
        expect(isQuantityAddon(terminalAddon)).toBe(true);
    });

    it('is a plain toggle for a recurring add-on', () => {
        expect(isQuantityAddon(toggleAddon)).toBe(false);
    });
});

describe('setAddonQuantity', () => {
    it('adds the add-on with a seat value for every one of its configs', () => {
        const next = setAddonQuantity(seatAddon, 1, { ...empty, seatsValues: [planSeat] });

        expect(next.enabledPricingIds).toEqual(['pric_seats']);
        expect(next.seatsValues).toEqual([
            planSeat,
            { pricing_item_config_id: 'pico_seat_eur', number: '1' },
            { pricing_item_config_id: 'pico_seat_usd', number: '1' },
        ]);
        expect(next.unitsValues).toEqual([]);
    });

    it('sets a one-off flat item as units and leaves the usage-based item alone', () => {
        const next = setAddonQuantity(terminalAddon, 2, empty);

        expect(next.unitsValues).toEqual([
            { pricing_item_config_id: 'pico_terminal', number: '2' },
        ]);
        expect(next.seatsValues).toEqual([]);
    });

    it('changes the quantity without adding the add-on twice', () => {
        const added = setAddonQuantity(seatAddon, 1, empty);
        const next = setAddonQuantity(seatAddon, 4, added);

        expect(next.enabledPricingIds).toEqual(['pric_seats']);
        expect(next.seatsValues.map(({ number }) => number)).toEqual(['4', '4']);
    });

    it('takes the add-on and its values out at 0 and keeps the plan seats', () => {
        const added = setAddonQuantity(seatAddon, 3, {
            ...empty,
            enabledPricingIds: ['pric_other'],
            seatsValues: [planSeat],
        });
        const next = setAddonQuantity(seatAddon, 0, added);

        expect(next.enabledPricingIds).toEqual(['pric_other']);
        expect(next.seatsValues).toEqual([planSeat]);
    });
});

describe('getAddonQuantity', () => {
    it('is 0 while the add-on is not in the order', () => {
        expect(getAddonQuantity(seatAddon, { ...empty, seatsValues: [planSeat] })).toBe(0);
    });

    it('reads the quantity back from the add-on values', () => {
        expect(getAddonQuantity(terminalAddon, setAddonQuantity(terminalAddon, 5, empty))).toBe(5);
    });
});

describe('getAddonMinimumQuantity', () => {
    const fiveSeatAddon = {
        id: 'pric_five_seats',
        items: [item('PER_SEAT', [{ id: 'pico_five', pricingType: 'FLAT', defaultNumber: '5' }])],
    } as unknown as PricingExtended;

    it("is the plan's default seats or units", () => {
        expect(getAddonMinimumQuantity(fiveSeatAddon)).toBe(5);
    });

    it('is 1 when the plan names no default', () => {
        expect(getAddonMinimumQuantity(seatAddon)).toBe(1);
    });

    it('takes the add-on out when stepped below the minimum', () => {
        const added = setAddonQuantity(fiveSeatAddon, 5, empty);
        const next = setAddonQuantity(fiveSeatAddon, 4, added);

        expect(next.enabledPricingIds).toEqual([]);
        expect(next.seatsValues).toEqual([]);
    });
});

describe('getAddonConfigIds', () => {
    it('lists only the configs a quantity is set on', () => {
        expect([...getAddonConfigIds([terminalAddon, seatAddon, toggleAddon])]).toEqual([
            'pico_terminal',
            'pico_seat_eur',
            'pico_seat_usd',
        ]);
    });
});
