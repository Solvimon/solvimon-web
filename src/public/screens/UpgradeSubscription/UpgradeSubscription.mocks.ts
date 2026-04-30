import type {
    Invoice,
    InvoicePreview,
    PaymentAcceptor,
    PaymentIntegration,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type {
    OnDemandPricing,
    OnDemandPricingCategory,
    OnDemandPricingItemsResponse,
} from './components/UpgradeSubscription/UpgradeSubscription.types';

const mockSubscriptionGetResponse = {
    object_type: 'PRICING_PLAN_SUBSCRIPTION',
    id: 'ppsu_hwDeeN0vhvcVCsAIdp1G',
    pricing_plan_schedule_infos: [
        {
            id: 'ppsc_IwDeeN0vhvcVCIAQdq1a',
            pricing_plan_version_id: 'ppve_MwDeeN0vhvcEuaADdd1f',
            start_at: '2026-04-05T22:00:00Z',
            pricing_plan_version: {
                pricing_categories: [
                    {
                        product_category: {
                            id: 'proc_iwDeeN0vhphn6VAtBD1w',
                            name: 'Add ons',
                        },
                        display_order: 1,
                        pricings: [
                            {
                                id: 'pric_ywDeeN0vhvcPguAadr1V',
                                name: 'Integration setup',
                                products: [{ name: 'Integration setup' }],
                                items: [
                                    {
                                        id: 'prii_NwDeeN0vhvcPguAxds12',
                                        product_items: [
                                            {
                                                name: 'Rillet integration setup',
                                                model_type: 'ONE_OFF',
                                            },
                                        ],
                                        configs: [
                                            {
                                                on_demand: true,
                                                bands: [
                                                    {
                                                        fixed_amount: {
                                                            quantity: '5000.00',
                                                            currency: 'EUR',
                                                        },
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        id: 'prii_IwDeeN0vhvcPgvAsdS1Q',
                                        product_items: [
                                            {
                                                name: 'Attio integration setup',
                                                model_type: 'ONE_OFF',
                                            },
                                        ],
                                        configs: [
                                            {
                                                on_demand: true,
                                                // FLAT type: price is in `amount`, not `fixed_amount`
                                                bands: [
                                                    {
                                                        amount: {
                                                            quantity: '50000.00',
                                                            currency: 'EUR',
                                                        },
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                        pricing_groups: [],
                    },
                ],
            },
        },
    ],
} as const;

// --- Types scoped to the mock ---

type MockBand = {
    fixed_amount?: { quantity: string; currency: string };
    amount?: { quantity: string; currency: string };
};

type MockItem = {
    id: string;
    product_items?: ReadonlyArray<{ name?: string; model_type?: string }>;
    configs?: ReadonlyArray<{
        on_demand?: boolean;
        bands?: ReadonlyArray<MockBand>;
    }>;
};

type MockPricing = {
    id: string;
    name?: string;
    products?: ReadonlyArray<{ name?: string; description?: string }>;
    items?: ReadonlyArray<MockItem>;
};

type MockPricingCategory = {
    display_order?: number;
    product_category?: { id?: string; name?: string };
    pricings?: ReadonlyArray<MockPricing>;
    pricing_groups?: ReadonlyArray<{
        id: string;
        name: string;
        pricings?: ReadonlyArray<MockPricing>;
    }>;
};

// --- Transformation ---

/**
 * Each on-demand item within a pricing becomes its own selectable row.
 * Name comes from product_items[0].name (e.g. "Rillet integration setup").
 * Price: fixed_amount takes priority, falls back to amount (used by FLAT type).
 */
const isOnDemandOneOffItem = (item: MockItem): boolean =>
    (item.configs?.some((c) => c.on_demand) ?? false) &&
    (item.product_items?.some((pi) => pi.model_type === 'ONE_OFF') ?? false);

const itemToRow = (item: MockItem): OnDemandPricing => ({
    id: item.id,
    name: item.product_items?.[0]?.name,
    items: [
        {
            id: item.id,
            configs: (item.configs ?? []).map((config) => ({
                bands: (config.bands ?? []).map((band) => ({
                    fixed_amount: band.fixed_amount ?? band.amount,
                })),
            })),
        },
    ],
});

const pricingToRows = (pricing: MockPricing): OnDemandPricing[] =>
    (pricing.items ?? []).filter(isOnDemandOneOffItem).map(itemToRow);

const categoryToOnDemand = (category: MockPricingCategory): OnDemandPricingCategory => ({
    display_order: category.display_order,
    product_category: category.product_category,
    pricings: (category.pricings ?? []).flatMap(pricingToRows),
    pricing_groups: (category.pricing_groups ?? [])
        .map((group) => ({
            id: group.id,
            name: group.name,
            pricings: (group.pricings ?? []).flatMap(pricingToRows),
        }))
        .filter((g) => g.pricings.length > 0),
});

// --- Preview mock ---

/**
 * Price (in EUR) per pricing item id, derived from mockSubscriptionGetResponse so
 * the two mocks stay in sync automatically when the mock data changes.
 */
const ITEM_PRICES_EUR: Record<string, number> = Object.fromEntries(
    mockSubscriptionGetResponse.pricing_plan_schedule_infos
        .flatMap((s) => s.pricing_plan_version.pricing_categories)
        .flatMap((cat) => cat.pricings)
        .flatMap((p) => p.items)
        .filter(isOnDemandOneOffItem)
        .map((item) => {
            const band: MockBand | undefined = item.configs?.[0]?.bands?.[0];
            const raw = band?.fixed_amount?.quantity ?? band?.amount?.quantity ?? '0';
            return [item.id, parseFloat(raw)] as const;
        }),
);

const VAT_RATE = 0.21;

const eur = (amount: number) => ({ quantity: amount.toFixed(2), currency: 'EUR' as const });

const mockPaymentAcceptor: PaymentAcceptor = {
    id: 'paya_NwDeeN0vgXgeP1AyNx14',
    object_type: 'PAYMENT_ACCEPTOR',
    status: 'ACTIVE',
    reference: 'mock-payment-acceptor',
    name: 'Mock payment acceptor',
    type: 'PAYMENT_GATEWAY',
};

const mockPaymentIntegration: PaymentIntegration = {
    id: 'intg_zwDeeN0vgXgeM6APNW1g',
    object_type: 'INTEGRATION',
    reference: 'mock-payment-integration',
    name: 'Mock payment integration',
    description: 'Mock payment integration',
    status: 'ACTIVE',
    type: 'PAYMENT_GATEWAY',
};

/**
 * Simulates `POST /v1/portal/pricing-plan-schedules/{id}/preview-on-demand-pricing-items`.
 * Returns a minimal InvoicePreview — only tax_summary is needed by the order summary UI.
 */
export const getMockPreviewResponse = (selectedItemIds: string[]): InvoicePreview => {
    const base = selectedItemIds.reduce((sum, id) => sum + (ITEM_PRICES_EUR[id] ?? 0), 0);
    const tax = Math.round(base * VAT_RATE * 100) / 100;
    const total = base + tax;

    return {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        invoice: {
            tax_summary: {
                base_amount: eur(base),
                tax_amount: eur(tax),
                total_amount: eur(total),
                country_code: 'NL',
            },
        } as unknown as Invoice,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        first_invoice: {} as unknown as Invoice,
        invoice_infos: [],
    };
};

export const getMockOnDemandPricingItemsResponse = (
    subscriptionId: string,
): OnDemandPricingItemsResponse => {
    const now = Date.now();
    const schedules = mockSubscriptionGetResponse.pricing_plan_schedule_infos;

    const activeSchedule =
        schedules.find((s) => {
            const start = Date.parse(s.start_at);
            return Number.isFinite(start) && start <= now;
        }) ?? schedules[0];

    const categories = (activeSchedule?.pricing_plan_version?.pricing_categories ?? [])
        .map(categoryToOnDemand)
        .filter((c) => (c.pricings?.length ?? 0) > 0 || (c.pricing_groups?.length ?? 0) > 0);

    return {
        pricing_plan_subscription_id: subscriptionId || mockSubscriptionGetResponse.id,
        pricing_plan_schedule_id: activeSchedule?.id ?? '',
        pricing_plan_version_id: activeSchedule?.pricing_plan_version_id ?? '',
        billing_period: { type: 'MONTH', value: 1 },
        billing_currency: 'EUR',
        pricing_categories: categories,
    };
};

// --- Payment method options mock ---

/**
 * Simulates `POST /v1/portal/payment-method-options`.
 * Only the `options[]` array is used by PaymentMethodPicker; the payment_acceptor and
 * integration fields are stubbed with the minimum shape required by the type.
 */
export const getMockPaymentMethodOptionsResponse = (): PaymentMethodOptionsResponse => [
    {
        payment_acceptor: mockPaymentAcceptor,
        integration: mockPaymentIntegration,
        options: [
            {
                name: 'iDeal',
                payment_method_variant: 'ONLINE_BANKING',
                payment_gateway_variant: 'ADYEN',
                adyen: { name: 'iDEAL | Wero', type: 'ideal' },
            },
            {
                name: 'Cards',
                payment_method_variant: 'CARD',
                payment_gateway_variant: 'ADYEN',
                adyen: {
                    name: 'Cards',
                    type: 'scheme',
                    brands: [
                        'maestro',
                        'accel',
                        'amex',
                        'cup',
                        'diners',
                        'hipercard',
                        'jcb',
                        'mc',
                        'nyce',
                        'pulse',
                        'star',
                        'visa',
                    ],
                },
            },
            {
                name: 'PayPal',
                payment_method_variant: 'DIGITAL_WALLET',
                payment_gateway_variant: 'ADYEN',
                adyen: { name: 'PayPal', type: 'paypal', configuration: { intent: 'capture' } },
            },
            {
                name: 'Trustly',
                payment_method_variant: 'ONLINE_BANKING',
                payment_gateway_variant: 'ADYEN',
                adyen: { name: 'Trustly - Instant Bank Payment', type: 'trustly' },
            },
        ],
    },
];
