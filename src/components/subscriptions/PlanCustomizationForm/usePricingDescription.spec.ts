import { ref } from 'vue';
import type { PricingExtended, PricingItemExtended } from '@solvimon/solvimon-types';
import { usePricingDescription } from './usePricingDescription';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // Resolves its own IntlProvider internally, which is not mounted here.
        usePricingItem: () => ({
            renderPricingForPricingItem: () => '$20.00 per month',
        }),
    });
});

const flatItem = ({
    name,
    modelType = 'USAGE_BASED',
    quantity,
    unitName,
}: {
    name: string;
    modelType?: string;
    quantity: string;
    unitName?: { singular: string; plural: string };
}) =>
    ({
        id: `prii_${name}`,
        product_items: [{ id: `proi_${name}`, name, model_type: modelType, unit_name: unitName }],
        pricing_currency_configs: [
            {
                currency: 'USD',
                configs: [
                    {
                        details: {
                            pricing_type: 'FLAT',
                            bands: [{ amount: { quantity, currency: 'USD' } }],
                        },
                    },
                ],
            },
        ],
    }) as unknown as PricingItemExtended;

const pricingOf = (...items: PricingItemExtended[]) =>
    ({ id: 'pric_1', product_type: 'ADDON', items }) as unknown as PricingExtended;

const describe_ = () =>
    usePricingDescription({
        currency: ref('USD'),
        billingPeriod: ref({ type: 'MONTH', value: 1 }),
    }).describePricing;

describe('usePricingDescription', () => {
    it('prices a usage-based flat item per unit used, not per billing period', () => {
        const describePricing = describe_();

        expect(
            describePricing(
                pricingOf(
                    flatItem({
                        name: 'Server hours',
                        quantity: '50.44',
                        unitName: { singular: 'hour', plural: 'hours' },
                    }),
                ),
            ),
        ).toBe('$50.44 per hour');
    });

    it('prices a usage-based item without a unit name per unit', () => {
        const describePricing = describe_();

        expect(describePricing(pricingOf(flatItem({ name: 'Server hours', quantity: '80' })))).toBe(
            '$80.00 per unit',
        );
    });

    it('lists every item of a pricing by name, not only the first', () => {
        const describePricing = describe_();

        expect(
            describePricing(
                pricingOf(
                    flatItem({ name: 'Server hours', quantity: '80' }),
                    flatItem({ name: 'GPU hours', quantity: '10' }),
                ),
            ),
        ).toBe('Server hours: $80.00 per unit · GPU hours: $10.00 per unit');
    });

    it('drops the product name an item name repeats, since the product name is shown above', () => {
        const describePricing = describe_();
        const pricing = {
            ...pricingOf(
                flatItem({ name: 'Nvidia B300 Server Hours', quantity: '80' }),
                flatItem({ name: 'Nvidia B300 GPU Hours', quantity: '10' }),
            ),
            products: [{ id: 'prod_1', name: 'Nvidia B300' }],
        } as unknown as PricingExtended;

        expect(describePricing(pricing)).toBe(
            'Server Hours: $80.00 per unit · GPU Hours: $10.00 per unit',
        );
    });

    it('leaves an item that is not usage-based to the ui renderer', () => {
        const describePricing = describe_();

        expect(
            describePricing(
                pricingOf(flatItem({ name: 'Licence', modelType: 'SUBSCRIPTION', quantity: '20' })),
            ),
        ).toBe('$20.00 per month');
    });

    it('says a pricing without items is unsupported', () => {
        const describePricing = describe_();

        expect(describePricing(pricingOf())).toBe('Unsupported pricing');
    });
});
