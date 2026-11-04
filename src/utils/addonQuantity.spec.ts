import type { PricingExtended, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import {
    getAddonConfigIds,
    getAddonMinimumQuantity,
    getAddonQuantity,
    getQuantityAddons,
    setAddonQuantity,
    type AddonSelection,
} from './addonQuantity';

type ConfigSpec = { id: string; pricingType: string; defaultNumber?: string; currency?: string };

const config = ({ id, pricingType, defaultNumber }: ConfigSpec) => ({
    id,
    details: { pricing_type: pricingType },
    ...(defaultNumber && {
        default_seats_value: { number: defaultNumber },
        default_units: { number: defaultNumber },
    }),
});

const item = (modelType: string, configs: ConfigSpec[]) => {
    const perCurrency = configs.filter(({ currency }) => currency);
    return {
        object_type: 'PRICING_ITEM',
        id: `prii_${configs[0]!.id}`,
        product_items: [{ model_type: modelType }],
        ...(perCurrency.length
            ? {
                  pricing_currency_configs: perCurrency.map((spec) => ({
                      currency: spec.currency,
                      configs: [config(spec)],
                  })),
              }
            : { configs: configs.map(config) }),
    };
};

const addon = (id: string, items: ReturnType<typeof item>[]) =>
    ({ id, product_type: 'ADDON', items }) as unknown as PricingExtended;

const terminalAddon = addon('pric_terminal', [
    item('ONE_OFF', [{ id: 'pico_terminal', pricingType: 'FLAT' }]),
    item('USAGE_BASED', [{ id: 'pico_service', pricingType: 'TOP_TIERED' }]),
]);
const seatAddon = addon('pric_seats', [
    item('PER_SEAT', [
        { id: 'pico_seat_eur', pricingType: 'FLAT', currency: 'EUR' },
        { id: 'pico_seat_usd', pricingType: 'FLAT', currency: 'USD' },
    ]),
]);
const toggleAddon = addon('pric_toggle', [
    item('RECURRING', [{ id: 'pico_toggle', pricingType: 'FLAT' }]),
]);

const planSeat = { pricing_item_config_id: 'pico_plan_seat', number: '3' };
const empty: AddonSelection = { enabledPricingIds: [], seatsValues: [], unitsValues: [] };

const subscriptionWith = ({
    pricings = [],
    groups = [],
}: {
    pricings?: PricingExtended[];
    groups?: { selection_constraint: string; pricings: PricingExtended[] }[];
}) =>
    ({
        pricing_plan_schedule_infos: [
            {
                pricing_plan_version: {
                    pricing_categories: [
                        {
                            pricings,
                            pricing_groups: groups.map((group) => ({
                                ...group,
                                product_type: 'ADDON',
                            })),
                        },
                    ],
                },
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('getQuantityAddons', () => {
    it('lists per-seat and one-off flat add-ons, but not a plain toggle', () => {
        const subscription = subscriptionWith({
            pricings: [terminalAddon, seatAddon, toggleAddon],
        });

        expect(getQuantityAddons(subscription).map(({ id }) => id)).toEqual([
            'pric_terminal',
            'pric_seats',
        ]);
    });

    it('takes add-ons from a pick-any group, not from a pick-at-most-one group', () => {
        const subscription = subscriptionWith({
            groups: [
                { selection_constraint: 'ANY', pricings: [seatAddon] },
                { selection_constraint: 'AT_MOST_ONE', pricings: [terminalAddon] },
            ],
        });

        expect(getQuantityAddons(subscription).map(({ id }) => id)).toEqual(['pric_seats']);
    });

    it('leaves an add-on the order gives seats of its own to the plan steppers', () => {
        const subscription = subscriptionWith({ pricings: [seatAddon, terminalAddon] });
        const orderValues = [{ pricing_item_config_id: 'pico_seat_eur', number: '10' }];

        expect(getQuantityAddons(subscription, orderValues).map(({ id }) => id)).toEqual([
            'pric_terminal',
        ]);
    });
});

describe('setAddonQuantity', () => {
    const eur = { currency: 'EUR' };

    it('adds the add-on with a seat value on its config on offer', () => {
        const next = setAddonQuantity(seatAddon, 1, { ...empty, seatsValues: [planSeat] }, eur);

        expect(next.enabledPricingIds).toEqual(['pric_seats']);
        expect(next.seatsValues).toEqual([
            planSeat,
            { pricing_item_config_id: 'pico_seat_eur', number: '1' },
        ]);
        expect(next.unitsValues).toEqual([]);
    });

    it('moves the quantity to the config on offer when the currency changes', () => {
        const added = setAddonQuantity(seatAddon, 2, empty, { currency: 'USD' });
        const next = setAddonQuantity(seatAddon, 2, added, eur);

        expect(next.seatsValues).toEqual([
            { pricing_item_config_id: 'pico_seat_eur', number: '2' },
        ]);
    });

    it('sets a one-off flat item as units and leaves the usage-based item alone', () => {
        const next = setAddonQuantity(terminalAddon, 2, empty);

        expect(next.unitsValues).toEqual([
            { pricing_item_config_id: 'pico_terminal', number: '2' },
        ]);
        expect(next.seatsValues).toEqual([]);
    });

    it('counts the seats of an add-on with seats and a one-off item, which keeps its default', () => {
        const licence = addon('pric_licence', [
            item('PER_SEAT', [{ id: 'pico_licence', pricingType: 'FLAT', defaultNumber: '5' }]),
            item('ONE_OFF', [{ id: 'pico_hardware', pricingType: 'FLAT' }]),
        ]);

        const next = setAddonQuantity(licence, 7, empty);

        expect(getAddonMinimumQuantity(licence)).toBe(5);
        expect(next.seatsValues).toEqual([{ pricing_item_config_id: 'pico_licence', number: '7' }]);
        expect(next.unitsValues).toEqual([
            { pricing_item_config_id: 'pico_hardware', number: '1' },
        ]);
    });

    it('changes the quantity without adding the add-on twice', () => {
        const added = setAddonQuantity(seatAddon, 1, empty, eur);
        const next = setAddonQuantity(seatAddon, 4, added, eur);

        expect(next.enabledPricingIds).toEqual(['pric_seats']);
        expect(next.seatsValues.map(({ number }) => number)).toEqual(['4']);
    });

    it('takes the add-on and all of its values out at 0 and keeps the plan seats', () => {
        const added = setAddonQuantity(
            seatAddon,
            3,
            { ...empty, enabledPricingIds: ['pric_other'], seatsValues: [planSeat] },
            eur,
        );
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
        const selection = setAddonQuantity(terminalAddon, 5, empty);
        expect(getAddonQuantity(terminalAddon, selection)).toBe(5);
    });

    it('is undefined for an add-on in the order without a value', () => {
        const selection = { ...empty, enabledPricingIds: ['pric_seats'] };
        expect(getAddonQuantity(seatAddon, selection)).toBeUndefined();
    });
});

describe('getAddonMinimumQuantity', () => {
    it("is the plan's default seats", () => {
        const fiveSeats = addon('pric_five', [
            item('PER_SEAT', [{ id: 'pico_five', pricingType: 'FLAT', defaultNumber: '5' }]),
        ]);
        expect(getAddonMinimumQuantity(fiveSeats)).toBe(5);
    });

    it('is 1 when the plan names no default', () => {
        expect(getAddonMinimumQuantity(seatAddon)).toBe(1);
    });

    it('reads the default of the currency on offer', () => {
        const perCurrency = addon('pric_currency', [
            item('PER_SEAT', [
                { id: 'pico_eur', pricingType: 'FLAT', defaultNumber: '10', currency: 'EUR' },
                { id: 'pico_usd', pricingType: 'FLAT', defaultNumber: '2', currency: 'USD' },
            ]),
        ]);

        expect(getAddonMinimumQuantity(perCurrency, { currency: 'USD' })).toBe(2);
        expect(getAddonMinimumQuantity(perCurrency, { currency: 'EUR' })).toBe(10);
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
