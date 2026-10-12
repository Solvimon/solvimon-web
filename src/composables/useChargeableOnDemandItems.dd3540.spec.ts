import { flushPromises } from '@vue/test-utils';
import type { OnDemandPricingItemsResponse } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useChargeableOnDemandItems } from './useChargeableOnDemandItems';

const { mockGetOnDemandPricingItems, mockError } = vi.hoisted(() => ({
    mockGetOnDemandPricingItems: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/services/pricingPlanSchedules', () => ({
    createPricingPlanSchedulesService: () => ({
        getOnDemandPricingItems: mockGetOnDemandPricingItems,
    }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: mockError }),
}));

const config = (id: string, overrides: Record<string, unknown> = {}) => ({
    object_type: 'PRICING_ITEM_CONFIG',
    id,
    order: 0,
    billing_in_advance: false,
    on_demand: true,
    details: {
        pricing_type: 'FIXED',
        bands: [{ fixed_amount: { quantity: '250', currency: 'EUR' } }],
    },
    ...overrides,
});

const response = {
    pricing_plan_schedule_id: 'ppsc_active',
    pricing_categories: [
        {
            product_category_id: 'prca_1',
            pricings: [
                {
                    object_type: 'PRICING',
                    id: 'pri_onboarding',
                    name: 'Onboarding package',
                    product_ids: [],
                    items: [
                        {
                            id: 'prii_onboarding',
                            product_item_ids: ['proi_onboarding'],
                            configs: [config('pric_1')],
                        },
                    ],
                },
                {
                    object_type: 'PRICING',
                    id: 'pri_credits',
                    name: 'Credits',
                    product_ids: [],
                    items: [
                        {
                            id: 'prii_credits',
                            product_item_ids: [],
                            configs: [
                                config('pric_2', { wallet_grants: [{ wallet_type_id: 'wty_1' }] }),
                            ],
                        },
                    ],
                },
            ],
        },
    ],
} as OnDemandPricingItemsResponse;

const createSubscription = (variant: PricingPlanSubscriptionExpanded['variant'] = 'DEFAULT') =>
    ({
        id: 'ppsu_1',
        variant,
        pricing_plan_schedule_infos: [
            {
                id: 'ppsc_active',
                type: 'DEFAULT',
                start_at: '2020-01-01T00:00:00Z',
                pricing_plan_schedule: { pricing_currency: 'EUR' },
                pricing_plan_version: {
                    pricing_categories: [
                        {
                            product_category_id: 'prca_1',
                            pricings: [
                                {
                                    id: 'pri_onboarding',
                                    product_ids: [],
                                    items: [
                                        {
                                            id: 'prii_onboarding',
                                            product_item_ids: ['proi_onboarding'],
                                            product_items: [
                                                { id: 'proi_onboarding', name: 'Kick-off session' },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('DD-3540 tester: useChargeableOnDemandItems', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs the error of a schedule the subscription moved on from', async () => {
        let rejectFirst: (error: Error) => void = () => {};
        mockGetOnDemandPricingItems
            .mockImplementationOnce(() => new Promise((_, reject) => (rejectFirst = reject)))
            .mockImplementationOnce(() => new Promise(() => {}));

        const subscription = ref(createSubscription());
        useChargeableOnDemandItems({ subscription });
        await flushPromises();

        subscription.value = JSON.parse(
            JSON.stringify(createSubscription()).replaceAll('ppsc_active', 'ppsc_next'),
        );
        await flushPromises();
        expect(mockGetOnDemandPricingItems).toHaveBeenCalledTimes(2);

        rejectFirst(new Error('boom'));
        await flushPromises();

        expect(mockError).toHaveBeenCalledWith(
            'ON_DEMAND_ITEMS_LOAD_FAILED',
            expect.any(String),
            { scheduleId: 'ppsc_active' },
            expect.any(Error),
        );
    });
});
