import type {
    PaymentMethodCard,
    Pricing,
    PricingItem,
    PricingItemConfig,
    Product,
    ProductItemExtended,
} from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import { describe, expect, it } from 'vitest';
import {
    getChargeableOnDemandItems,
    getPayablePaymentMethods,
    toChargePricingItems,
} from './chargeOnDemand';

const buildOnDemandConfig = (
    overrides: Partial<PricingItemConfig> & Pick<PricingItemConfig, 'id' | 'details'>,
): PricingItemConfig => ({
    object_type: 'PRICING_ITEM_CONFIG',
    order: 0,
    billing_in_advance: false,
    on_demand: true,
    ...overrides,
});

const buildPricing = (
    overrides: Partial<Pricing> & Pick<Pricing, 'id'>,
    items: PricingItem[],
): Pricing => ({
    object_type: 'PRICING',
    product_ids: [],
    items,
    ...overrides,
});

const buildPricingItem = (
    id: string,
    configs: PricingItemConfig[],
    productItemIds: string[] = [],
): PricingItem => ({
    id,
    product_item_ids: productItemIds,
    configs,
});

const buildCardPaymentMethod = (
    overrides: Partial<PaymentMethodCard> & Pick<PaymentMethodCard, 'id'>,
): PaymentMethodCard => ({
    object_type: 'PAYMENT_METHOD',
    created_at: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    is_default: false,
    type: 'CARD',
    reference: overrides.id,
    integration_id: 'integration-stripe',
    card: {
        brand: 'VISA',
        last_four_digits: '1142',
        expiry_date: { expiry_month: 3, expiry_year: 2030 },
    },
    ...overrides,
});

const chargeOnDemandItemsFixture: ChargeOnDemandItem[] = [
    {
        pricingItemId: 'pricing-item-consulting',
        pricingItemConfigId: 'config-consulting',
        name: 'Consulting hours',
        priceType: 'FLAT',
        price: { quantity: '120', currency: 'EUR' },
        defaultUnits: 2,
    },
    {
        pricingItemId: 'pricing-item-onboarding',
        pricingItemConfigId: 'config-onboarding',
        name: 'Onboarding package',
        priceType: 'FIXED',
        price: { quantity: '250', currency: 'EUR' },
        defaultUnits: 1,
    },
    {
        pricingItemId: 'pricing-item-import',
        pricingItemConfigId: 'config-import',
        name: 'Historical data import',
        priceType: 'FIXED',
        price: { quantity: '99', currency: 'EUR' },
        defaultUnits: 1,
    },
];

const fixedConfig = buildOnDemandConfig({
    id: 'config-fixed',
    details: {
        pricing_type: 'FIXED',
        bands: [{ fixed_amount: { quantity: '250', currency: 'EUR' } }],
    },
});
const flatConfig = buildOnDemandConfig({
    id: 'config-flat',
    details: { pricing_type: 'FLAT', bands: [{ amount: { quantity: '120', currency: 'EUR' } }] },
    default_units: { number: '3' },
});

describe('getChargeableOnDemandItems', () => {
    it('lists FIXED and FLAT items, those in a pricing group first', () => {
        const items = getChargeableOnDemandItems({
            pricing_categories: [
                {
                    product_category_id: 'category',
                    pricings: [
                        buildPricing({ id: 'pricing-onboarding', name: 'Onboarding' }, [
                            buildPricingItem('item-fixed', [fixedConfig]),
                        ]),
                    ],
                    pricing_groups: [
                        {
                            object_type: 'PRICING_GROUP',
                            id: 'group',
                            name: 'Services',
                            product_type: 'ADDON',
                            pricings: [
                                buildPricing({ id: 'pricing-consulting', name: 'Consulting' }, [
                                    buildPricingItem('item-flat', [flatConfig]),
                                ]),
                            ],
                        },
                    ],
                },
            ],
        });

        expect(items).toEqual([
            {
                pricingItemId: 'item-flat',
                pricingItemConfigId: 'config-flat',
                name: 'Consulting',
                priceType: 'FLAT',
                price: { quantity: '120', currency: 'EUR' },
                defaultUnits: 3,
            },
            {
                pricingItemId: 'item-fixed',
                pricingItemConfigId: 'config-fixed',
                name: 'Onboarding',
                priceType: 'FIXED',
                price: { quantity: '250', currency: 'EUR' },
                defaultUnits: 1,
            },
        ]);
    });

    it('leaves out FLEXIBLE items', () => {
        const flexibleConfig = buildOnDemandConfig({
            id: 'config-flexible',
            details: { pricing_type: 'FLEXIBLE', bands: [{}] },
        });

        expect(
            getChargeableOnDemandItems({
                pricing_categories: [
                    {
                        product_category_id: 'category',
                        pricings: [
                            buildPricing({ id: 'pricing', name: 'Donation' }, [
                                buildPricingItem('item-flexible', [flexibleConfig]),
                            ]),
                        ],
                    },
                ],
            }),
        ).toEqual([]);
    });

    it('leaves out an item whose on-demand config grants wallet credits', () => {
        const walletConfig = buildOnDemandConfig({
            id: 'config-wallet',
            details: {
                pricing_type: 'FIXED',
                bands: [{ fixed_amount: { quantity: '50', currency: 'USD' } }],
            },
            wallet_grants: [{ wallet_type_id: 'wallet-type' }],
        });

        expect(
            getChargeableOnDemandItems({
                pricing_categories: [
                    {
                        product_category_id: 'category',
                        pricings: [
                            buildPricing({ id: 'pricing', name: 'Credits' }, [
                                buildPricingItem('item-credits', [walletConfig]),
                            ]),
                        ],
                    },
                ],
            }),
        ).toEqual([]);
    });

    it('starts a FLAT item at 1 when its default units is not a quantity that can be ordered', () => {
        const [item] = getChargeableOnDemandItems({
            pricing_categories: [
                {
                    product_category_id: 'category',
                    pricings: [
                        buildPricing({ id: 'pricing', name: 'Consulting' }, [
                            buildPricingItem('item', [
                                { ...flatConfig, default_units: { number: '0' } },
                            ]),
                        ]),
                    ],
                },
            ],
        });

        expect(item?.defaultUnits).toBe(1);
    });

    describe('naming items from the subscription', () => {
        const product: Product = {
            object_type: 'PRODUCT',
            id: 'product',
            category_id: 'category',
            name: 'On-Demand Demo Product',
            product_type: 'DEFAULT',
            status: 'ACTIVE',
            reference: 'product',
        };
        const productItem: ProductItemExtended = {
            object_type: 'PRODUCT_ITEM',
            id: 'product-item',
            type: 'REVENUE',
            product_id: product.id,
            name: 'On-demand per-unit fee',
            model_type: 'ONE_OFF',
            reference: 'product-item',
        };
        const pricingPlanVersions = [
            {
                pricing_categories: [
                    {
                        product_category_id: 'category',
                        pricings: [
                            {
                                ...buildPricing({ id: 'pricing', product_ids: [product.id] }, []),
                                products: [product],
                                items: [
                                    {
                                        ...buildPricingItem(
                                            'subscription-item',
                                            [],
                                            [productItem.id],
                                        ),
                                        product_items: [productItem],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ];
        const getName = ({
            pricingName,
            productItemIds = [productItem.id],
        }: {
            pricingName?: string;
            productItemIds?: string[];
        }) =>
            getChargeableOnDemandItems(
                {
                    pricing_categories: [
                        {
                            product_category_id: 'category',
                            pricings: [
                                buildPricing(
                                    { id: 'pricing', name: pricingName, product_ids: [product.id] },
                                    [
                                        buildPricingItem(
                                            'on-demand-item',
                                            [flatConfig],
                                            productItemIds,
                                        ),
                                    ],
                                ),
                            ],
                        },
                    ],
                },
                { pricingPlanVersions },
            )[0]?.name;

        it('names an item by its product item, matched by id', () => {
            expect(getName({ pricingName: 'Consulting' })).toBe('On-demand per-unit fee');
        });

        it('names an item without a known product item by its pricing', () => {
            expect(getName({ pricingName: 'Consulting', productItemIds: ['unknown'] })).toBe(
                'Consulting',
            );
        });

        it("names an item without a known product item or pricing name by the pricing's product", () => {
            expect(getName({ productItemIds: ['unknown'] })).toBe('On-Demand Demo Product');
        });
    });

    it('returns nothing without a response', () => {
        expect(getChargeableOnDemandItems(undefined)).toEqual([]);
    });
});

describe('getPayablePaymentMethods', () => {
    const subscription = {
        payment_acceptors: [
            { id: 'acceptor-stripe', payment_gateway: { integration_id: 'integration-stripe' } },
        ],
        payment_method_id: 'pm-subscription',
    };

    it("keeps the ACTIVE methods on one of the subscription's payment acceptors, the subscription's own first", () => {
        const methods = getPayablePaymentMethods(
            [
                buildCardPaymentMethod({ id: 'pm-other' }),
                buildCardPaymentMethod({ id: 'pm-subscription' }),
                buildCardPaymentMethod({ id: 'pm-inactive', status: 'INACTIVE' }),
                buildCardPaymentMethod({ id: 'pm-adyen', integration_id: 'integration-adyen' }),
            ],
            subscription,
        );

        expect(methods.map(({ id }) => id)).toEqual(['pm-subscription', 'pm-other']);
    });

    it('returns nothing when the subscription has no payment acceptors', () => {
        expect(
            getPayablePaymentMethods([buildCardPaymentMethod({ id: 'pm' })], {
                ...subscription,
                payment_acceptors: [],
            }),
        ).toEqual([]);
    });
});

describe('toChargePricingItems', () => {
    it('sends units for FLAT items only, in the order they were added', () => {
        expect(
            toChargePricingItems(
                [
                    { pricingItemId: 'pricing-item-onboarding' },
                    { pricingItemId: 'pricing-item-consulting', units: 4 },
                ],
                chargeOnDemandItemsFixture,
            ),
        ).toEqual([
            { pricing_item_id: 'pricing-item-onboarding' },
            { pricing_item_id: 'pricing-item-consulting', units: { number: '4' } },
        ]);
    });

    it.each([NaN, 0, -2, 1.5])('sends the default units for %s units', (units) => {
        expect(
            toChargePricingItems(
                [{ pricingItemId: 'pricing-item-consulting', units }],
                chargeOnDemandItemsFixture,
            ),
        ).toEqual([{ pricing_item_id: 'pricing-item-consulting', units: { number: '2' } }]);
    });

    it('leaves out items that are not listed', () => {
        expect(
            toChargePricingItems([{ pricingItemId: 'unknown' }], chargeOnDemandItemsFixture),
        ).toEqual([]);
    });
});
