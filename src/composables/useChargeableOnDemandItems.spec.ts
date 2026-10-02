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
                            product_item_ids: [],
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
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('useChargeableOnDemandItems', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOnDemandPricingItems.mockResolvedValue(response);
    });

    it("lists the orderable items of the subscription's active schedule, without wallet top-ups", async () => {
        const { items, scheduleId } = useChargeableOnDemandItems({
            subscription: ref(createSubscription()),
        });
        await flushPromises();

        expect(mockGetOnDemandPricingItems).toHaveBeenCalledWith({ scheduleId: 'ppsc_active' });
        expect(scheduleId.value).toBe('ppsc_active');
        expect(items.value.map(({ pricingItemId }) => pricingItemId)).toEqual(['prii_onboarding']);
    });

    it('offers nothing on a subscription that is not DEFAULT', async () => {
        const { items } = useChargeableOnDemandItems({
            subscription: ref(createSubscription('FORWARD_BILLING')),
        });
        await flushPromises();

        expect(mockGetOnDemandPricingItems).not.toHaveBeenCalled();
        expect(items.value).toEqual([]);
    });

    it('waits for the subscription before loading', async () => {
        const subscription = ref<PricingPlanSubscriptionExpanded>();
        useChargeableOnDemandItems({ subscription });
        await flushPromises();

        expect(mockGetOnDemandPricingItems).not.toHaveBeenCalled();

        subscription.value = createSubscription();
        await flushPromises();

        expect(mockGetOnDemandPricingItems).toHaveBeenCalledTimes(1);
    });

    it('offers nothing and reports it when the items cannot be loaded', async () => {
        mockGetOnDemandPricingItems.mockRejectedValue(new Error('boom'));

        const { items } = useChargeableOnDemandItems({ subscription: ref(createSubscription()) });
        await flushPromises();

        expect(items.value).toEqual([]);
        expect(mockError).toHaveBeenCalledWith(
            'ON_DEMAND_ITEMS_LOAD_FAILED',
            expect.any(String),
            { scheduleId: 'ppsc_active' },
            expect.any(Error),
        );
    });
});
