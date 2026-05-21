import { useSeatBasedPricing } from './useSeatBasedPricing';
import type {
    Amount,
    BillingPeriod,
    PricingExtended,
    PricingItemConfigExtended,
    PricingItemExtended,
    ProductItemExtended,
} from '@solvimon/solvimon-types';
import { getPricingItemByPricingConfigId } from '@/utils/pricingItem';

vi.mock('@/utils/pricingItem');

describe('useSeatBasedPricing', () => {
    const mockGetPricingItemByPricingConfigId = vi.mocked(getPricingItemByPricingConfigId);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockConfig = (
        id: string,
        type: 'FLAT' | 'TIERED' = 'FLAT',
        billingPeriod?: BillingPeriod,
        billingInAdvance = false,
        bands?: NonNullable<PricingItemConfigExtended['details']>['bands'],
    ): PricingItemConfigExtended =>
        ({
            object_type: 'PRICING_ITEM_CONFIG',
            id,
            order: 0,
            billing_in_advance: billingInAdvance,
            billing_period: billingPeriod,
            details: {
                pricing_type: type,
                bands,
            },
        }) as PricingItemConfigExtended;

    const createMockProductItem = (name?: string, description?: string): ProductItemExtended =>
        ({
            object_type: 'PRODUCT_ITEM',
            id: 'product-item-1',
            type: 'REVENUE',
            product_id: 'product-1',
            name,
            description,
            model_type: 'RECURRING',
            reference: 'ref-1',
            status: 'ACTIVE',
        }) as ProductItemExtended;

    const createMockPricing = (id: string): PricingExtended =>
        ({
            id,
            object_type: 'PRICING',
            product_ids: [],
        }) as PricingExtended;

    it('should return empty values when config and productItem are undefined', () => {
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config: undefined,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value).toEqual({
            billing: {
                period: undefined,
                billedInAdvance: undefined,
            },
            product: {
                name: undefined,
                description: undefined,
            },
            pricing: {},
        });
    });

    it('should return billing period and billedInAdvance from config', () => {
        const billingPeriod: BillingPeriod = { type: 'MONTH', value: 1 };
        const config = createMockConfig('config-1', 'FLAT', billingPeriod, true);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.billing).toEqual({
            period: billingPeriod,
            billedInAdvance: true,
        });
    });

    it('should return product name and description from productItem', () => {
        const productItem = createMockProductItem('Test Product', 'Test Description');
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config: undefined,
            productItem,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.product).toEqual({
            name: 'Test Product',
            description: 'Test Description',
        });
    });

    it('should return amount for FLAT pricing type with bands', () => {
        const amount: Amount = { quantity: '100', currency: 'USD' };
        const config = createMockConfig('config-1', 'FLAT', undefined, false, [
            { amount },
        ] as NonNullable<PricingItemConfigExtended['details']>['bands']);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.pricing).toEqual({
            amount,
        });
    });

    it('should return empty pricing when FLAT type has no bands', () => {
        const config = createMockConfig('config-1', 'FLAT', undefined, false, undefined);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.pricing).toEqual({});
    });

    it('should return empty pricing when FLAT type has empty bands array', () => {
        const config = createMockConfig('config-1', 'FLAT', undefined, false, []);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.pricing).toEqual({});
    });

    it('should return tiered bands for TIERED pricing type', () => {
        const bands = [
            { tier_top_bound: { number: '10' }, amount: { quantity: '50', currency: 'USD' } },
            { tier_top_bound: { number: '20' }, amount: { quantity: '40', currency: 'USD' } },
        ] as NonNullable<PricingItemConfigExtended['details']>['bands'];
        const config = createMockConfig('config-1', 'TIERED', undefined, false, bands);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.pricing).toEqual({
            tiered: { bands },
        });
    });

    it('should return empty pricing when TIERED type has no bands', () => {
        const config = createMockConfig('config-1', 'TIERED', undefined, false, undefined);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.pricing).toEqual({
            tiered: { bands: undefined },
        });
    });

    it('should return empty pricing for non-FLAT and non-TIERED types', () => {
        const config = createMockConfig('config-1', 'VOLUME' as any, undefined, false);
        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem: undefined,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value.pricing).toEqual({});
    });

    it('should combine all properties correctly', () => {
        const billingPeriod: BillingPeriod = { type: 'YEAR', value: 1 };
        const amount: Amount = { quantity: '1000', currency: 'EUR' };
        const config = createMockConfig('config-1', 'FLAT', billingPeriod, true, [
            { amount },
        ] as NonNullable<PricingItemConfigExtended['details']>['bands']);
        const productItem = createMockProductItem('Premium Seats', 'Premium seat pricing');

        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config,
            productItem,
        });

        const pricings: PricingExtended[] = [createMockPricing('pricing-1')];
        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId: 'config-1',
        });

        expect(result.value).toEqual({
            billing: {
                period: billingPeriod,
                billedInAdvance: true,
            },
            product: {
                name: 'Premium Seats',
                description: 'Premium seat pricing',
            },
            pricing: {
                amount,
            },
        });
    });

    it('should call getPricingItemByPricingConfigId with correct parameters', () => {
        const pricings: PricingExtended[] = [
            createMockPricing('pricing-1'),
            createMockPricing('pricing-2'),
        ];
        const pricingItemConfigId = 'config-123';

        mockGetPricingItemByPricingConfigId.mockReturnValue({
            config: undefined,
            productItem: undefined,
        });

        const result = useSeatBasedPricing({
            pricings,
            pricingItemConfigId,
        });

        // Access .value to trigger the computed evaluation
        result.value;

        expect(mockGetPricingItemByPricingConfigId).toHaveBeenCalledWith({
            pricings,
            pricingItemConfigId,
        });
    });
});
