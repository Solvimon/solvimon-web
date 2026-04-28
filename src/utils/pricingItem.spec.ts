import { getPricingItemByPricingConfigId } from './pricingItem';
import type {
    PricingExtended,
    PricingItemConfigExtended,
    PricingItemExtended,
    ProductItemExtended,
} from '@solvimon/solvimon-types';

describe('pricingItem utils', () => {
    describe('getPricingItemByPricingConfigId', () => {
        const createMockConfig = (id: string): PricingItemConfigExtended =>
            ({
                object_type: 'PRICING_ITEM_CONFIG',
                id,
                type: 'FLAT',
                order: 0,
                billing_in_advance: false,
            }) as PricingItemConfigExtended;

        const createMockProductItem = (id: string): ProductItemExtended =>
            ({
                object_type: 'PRODUCT_ITEM',
                id,
                type: 'REVENUE',
                product_id: 'product-1',
                name: 'Test Product',
                model_type: 'RECURRING',
                reference: 'ref-1',
                status: 'ACTIVE',
            }) as ProductItemExtended;

        const createMockPricingItem = (
            id: string,
            configs?: PricingItemConfigExtended[],
            productItems?: ProductItemExtended[],
        ): PricingItemExtended =>
            ({
                id,
                product_item_ids: productItems?.map((item) => item.id) ?? [],
                configs,
                product_items: productItems,
            }) as PricingItemExtended;

        const createMockPricing = (
            id: string,
            items?: PricingItemExtended[],
        ): PricingExtended =>
            ({
                id,
                object_type: 'PRICING',
                product_ids: [],
                items,
            }) as PricingExtended;

        it('should return undefined config and productItem when pricings array is empty', () => {
            const pricings: PricingExtended[] = [];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-1',
            });

            expect(result.config).toBeUndefined();
            expect(result.productItem).toBeUndefined();
        });

        it('should return undefined config and productItem when pricings have no items', () => {
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1'),
                createMockPricing('pricing-2'),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-1',
            });

            expect(result.config).toBeUndefined();
            expect(result.productItem).toBeUndefined();
        });

        it('should return undefined config and productItem when items have no configs', () => {
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1'),
                    createMockPricingItem('item-2'),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-1',
            });

            expect(result.config).toBeUndefined();
            expect(result.productItem).toBeUndefined();
        });

        it('should return undefined config and productItem when no config matches the id', () => {
            const config1 = createMockConfig('config-1');
            const config2 = createMockConfig('config-2');
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', [config1, config2]),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-3',
            });

            expect(result.config).toBeUndefined();
            expect(result.productItem).toBeUndefined();
        });

        it('should return the matching config and undefined productItem when item has no product_items', () => {
            const config1 = createMockConfig('config-1');
            const config2 = createMockConfig('config-2');
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', [config1, config2]),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-2',
            });

            expect(result.config).toBeDefined();
            expect(result.config?.id).toBe('config-2');
            expect(result.productItem).toBeUndefined();
        });

        it('should return the matching config and first productItem when item has product_items', () => {
            const config1 = createMockConfig('config-1');
            const productItem1 = createMockProductItem('product-item-1');
            const productItem2 = createMockProductItem('product-item-2');
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', [config1], [productItem1, productItem2]),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-1',
            });

            expect(result.config).toBeDefined();
            expect(result.config?.id).toBe('config-1');
            expect(result.productItem).toBeDefined();
            expect(result.productItem?.id).toBe('product-item-1');
        });

        it('should find config across multiple pricings', () => {
            const config1 = createMockConfig('config-1');
            const config2 = createMockConfig('config-2');
            const config3 = createMockConfig('config-3');
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', [config1]),
                ]),
                createMockPricing('pricing-2', [
                    createMockPricingItem('item-2', [config2]),
                    createMockPricingItem('item-3', [config3]),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-2',
            });

            expect(result.config).toBeDefined();
            expect(result.config?.id).toBe('config-2');
        });

        it('should find config in nested items across multiple pricings', () => {
            const config1 = createMockConfig('config-1');
            const config2 = createMockConfig('config-2');
            const config3 = createMockConfig('config-3');
            const productItem = createMockProductItem('product-item-1');
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', [config1]),
                    createMockPricingItem('item-2', [config2], [productItem]),
                ]),
                createMockPricing('pricing-2', [
                    createMockPricingItem('item-3', [config3]),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-2',
            });

            expect(result.config).toBeDefined();
            expect(result.config?.id).toBe('config-2');
            expect(result.productItem).toBeDefined();
            expect(result.productItem?.id).toBe('product-item-1');
        });

        it('should return the first matching config when multiple items have the same config id', () => {
            const config1 = createMockConfig('config-1');
            const config2 = createMockConfig('config-2');
            const productItem1 = createMockProductItem('product-item-1');
            const productItem2 = createMockProductItem('product-item-2');
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', [config1], [productItem1]),
                    createMockPricingItem('item-2', [config2], [productItem2]),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-1',
            });

            expect(result.config).toBeDefined();
            expect(result.config?.id).toBe('config-1');
            expect(result.productItem).toBeDefined();
            expect(result.productItem?.id).toBe('product-item-1');
        });

        it('should handle items with undefined configs array', () => {
            const pricings: PricingExtended[] = [
                createMockPricing('pricing-1', [
                    createMockPricingItem('item-1', undefined),
                ]),
            ];

            const result = getPricingItemByPricingConfigId({
                pricings,
                pricingItemConfigId: 'config-1',
            });

            expect(result.config).toBeUndefined();
            expect(result.productItem).toBeUndefined();
        });
    });
});
