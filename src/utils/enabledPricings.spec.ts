import { describe, it, expect, vi } from 'vitest';
import {
    withPreselectedEnabledPricings,
    isSubscriptionWithEnabledPricings,
} from './enabledPricings';
import type {
    Pricing,
    PricingExtended,
    PricingGroupExtended,
    PricingPlanSubscriptionExpanded,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/types';
import { getPricingGroupsFromExtendedPricingPlanSubscription } from './subscription';

// Mock the subscription utility
vi.mock('./subscription', () => ({
    getPricingGroupsFromExtendedPricingPlanSubscription: vi.fn(),
}));

describe('enabledPricings utils', () => {
    const createMockPricing = (id: string): PricingExtended =>
        ({
            id,
            object_type: 'PRICING',
            product_ids: [],
        }) as PricingExtended;

    const createMockPricingGroup = (
        id: string,
        selectionConstraint: PricingGroupExtended['selection_constraint'],
        pricings: PricingExtended[],
    ): PricingGroupExtended =>
        ({
            object_type: 'PRICING_GROUP',
            id,
            pricing_plan_version_id: 'version-1',
            name: `Group ${id}`,
            product_type: 'DEFAULT',
            selection_constraint: selectionConstraint,
            pricings,
        }) as PricingGroupExtended;

    const createMockSubscription = (): PricingPlanSubscriptionExpanded =>
        ({
            id: 'subscription-1',
            object_type: 'PRICING_PLAN_SUBSCRIPTION',
            pricing_plan_schedule_infos: [] as PricingPlanScheduleInfoExpanded[],
        }) as PricingPlanSubscriptionExpanded;

    describe('withPreselectedEnabledPricings', () => {
        it('should return empty array when enabledPricingIds is undefined and no pricing groups', () => {
            const subscription = createMockSubscription();
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([]);

            const result = withPreselectedEnabledPricings(subscription);

            expect(result).toEqual([]);
        });

        it('should return provided enabledPricingIds when no pricing groups match constraints', () => {
            const subscription = createMockSubscription();
            const enabledPricingIds: Pricing['id'][] = ['pricing-1', 'pricing-2'];
            const pricingGroup = createMockPricingGroup('group-1', 'ANY', [
                createMockPricing('pricing-3'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                pricingGroup,
            ]);

            const result = withPreselectedEnabledPricings(subscription, enabledPricingIds);

            expect(result).toEqual(enabledPricingIds);
        });

        it('should add first pricing from EXACTLY_ONE group when no pricing from that group is selected', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricingGroup = createMockPricingGroup('group-1', 'EXACTLY_ONE', [
                pricing1,
                pricing2,
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                pricingGroup,
            ]);

            const result = withPreselectedEnabledPricings(subscription);

            expect(result).toEqual(['pricing-1']);
        });

        it('should add first pricing from AT_LEAST_ONE group when no pricing from that group is selected', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricingGroup = createMockPricingGroup('group-1', 'AT_LEAST_ONE', [
                pricing1,
                pricing2,
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                pricingGroup,
            ]);

            const result = withPreselectedEnabledPricings(subscription);

            expect(result).toEqual(['pricing-1']);
        });

        it('should not add pricing from EXACTLY_ONE group when a pricing from that group is already selected', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricingGroup = createMockPricingGroup('group-1', 'EXACTLY_ONE', [
                pricing1,
                pricing2,
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                pricingGroup,
            ]);

            const result = withPreselectedEnabledPricings(subscription, ['pricing-2']);

            expect(result).toEqual(['pricing-2']);
        });

        it('should not add pricing from AT_LEAST_ONE group when a pricing from that group is already selected', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricingGroup = createMockPricingGroup('group-1', 'AT_LEAST_ONE', [
                pricing1,
                pricing2,
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                pricingGroup,
            ]);

            const result = withPreselectedEnabledPricings(subscription, ['pricing-2']);

            expect(result).toEqual(['pricing-2']);
        });

        it('should handle multiple pricing groups with different constraints', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricing3 = createMockPricing('pricing-3');
            const pricing4 = createMockPricing('pricing-4');
            const pricing5 = createMockPricing('pricing-5');

            const group1 = createMockPricingGroup('group-1', 'EXACTLY_ONE', [pricing1, pricing2]);
            const group2 = createMockPricingGroup('group-2', 'AT_LEAST_ONE', [pricing3]);
            const group3 = createMockPricingGroup('group-3', 'AT_MOST_ONE', [pricing4]);
            const group4 = createMockPricingGroup('group-4', 'ANY', [pricing5]);

            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
                group3,
                group4,
            ]);

            const result = withPreselectedEnabledPricings(subscription);

            // Should only add from EXACTLY_ONE and AT_LEAST_ONE groups
            expect(result).toEqual(['pricing-1', 'pricing-3']);
        });

        it('should preserve existing enabledPricingIds and add new ones from groups', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricing3 = createMockPricing('pricing-3');
            const pricing4 = createMockPricing('pricing-4');

            const group1 = createMockPricingGroup('group-1', 'EXACTLY_ONE', [pricing1, pricing2]);
            const group2 = createMockPricingGroup('group-2', 'AT_LEAST_ONE', [pricing3, pricing4]);

            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            const result = withPreselectedEnabledPricings(subscription, ['existing-pricing-1']);

            expect(result).toEqual(['existing-pricing-1', 'pricing-1', 'pricing-3']);
        });

        it('should throw error when group has empty pricings array', () => {
            const subscription = createMockSubscription();
            const pricingGroup = createMockPricingGroup('group-1', 'EXACTLY_ONE', []);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                pricingGroup,
            ]);

            // The implementation accesses pricings[0].id without checking if the array is empty
            expect(() => withPreselectedEnabledPricings(subscription)).toThrow();
        });

        it('should handle multiple groups where some already have selected pricings', () => {
            const subscription = createMockSubscription();
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricing3 = createMockPricing('pricing-3');
            const pricing4 = createMockPricing('pricing-4');

            const group1 = createMockPricingGroup('group-1', 'EXACTLY_ONE', [pricing1, pricing2]);
            const group2 = createMockPricingGroup('group-2', 'AT_LEAST_ONE', [pricing3, pricing4]);

            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            // pricing-2 is from group1, so group1 should be skipped
            // pricing-3 is from group2, so group2 should be skipped
            const result = withPreselectedEnabledPricings(subscription, ['pricing-2', 'pricing-3']);

            expect(result).toEqual(['pricing-2', 'pricing-3']);
        });
    });

    describe('isSubscriptionWithEnabledPricings', () => {
        it('should return false when no pricing groups exist', () => {
            const subscription = createMockSubscription();
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(false);
        });

        it('should return false when no groups have EXACTLY_ONE or AT_LEAST_ONE constraints', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', 'AT_MOST_ONE', [
                createMockPricing('pricing-1'),
            ]);
            const group2 = createMockPricingGroup('group-2', 'ANY', [
                createMockPricing('pricing-2'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(false);
        });

        it('should return true when at least one group has EXACTLY_ONE constraint', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', 'EXACTLY_ONE', [
                createMockPricing('pricing-1'),
            ]);
            const group2 = createMockPricingGroup('group-2', 'ANY', [
                createMockPricing('pricing-2'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(true);
        });

        it('should return true when at least one group has AT_LEAST_ONE constraint', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', 'AT_LEAST_ONE', [
                createMockPricing('pricing-1'),
            ]);
            const group2 = createMockPricingGroup('group-2', 'ANY', [
                createMockPricing('pricing-2'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(true);
        });

        it('should return true when multiple groups have EXACTLY_ONE or AT_LEAST_ONE constraints', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', 'EXACTLY_ONE', [
                createMockPricing('pricing-1'),
            ]);
            const group2 = createMockPricingGroup('group-2', 'AT_LEAST_ONE', [
                createMockPricing('pricing-2'),
            ]);
            const group3 = createMockPricingGroup('group-3', 'EXACTLY_ONE', [
                createMockPricing('pricing-3'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
                group3,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(true);
        });

        it('should return false when groups have undefined selection_constraint', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', undefined as any, [
                createMockPricing('pricing-1'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(false);
        });

        it('should return true when first group has EXACTLY_ONE and others do not', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', 'EXACTLY_ONE', [
                createMockPricing('pricing-1'),
            ]);
            const group2 = createMockPricingGroup('group-2', 'AT_MOST_ONE', [
                createMockPricing('pricing-2'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(true);
        });

        it('should return true when last group has AT_LEAST_ONE and others do not', () => {
            const subscription = createMockSubscription();
            const group1 = createMockPricingGroup('group-1', 'ANY', [
                createMockPricing('pricing-1'),
            ]);
            const group2 = createMockPricingGroup('group-2', 'AT_LEAST_ONE', [
                createMockPricing('pricing-2'),
            ]);
            vi.mocked(getPricingGroupsFromExtendedPricingPlanSubscription).mockReturnValue([
                group1,
                group2,
            ]);

            const result = isSubscriptionWithEnabledPricings(subscription);

            expect(result).toBe(true);
        });
    });
});
