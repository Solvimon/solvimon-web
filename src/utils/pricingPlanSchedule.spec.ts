import { describe, it, expect } from 'vitest';
import { getFirstPricingPlanScheduleOfType, getScheduleCustomizations } from './pricingPlanSchedule';
import type {
    ConfiguredMeterValue,
    EnabledPricing,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/types';

describe('pricingPlanSchedule utils', () => {
    describe('getFirstPricingPlanScheduleOfType', () => {
        const createMockScheduleInfo = (
            id: string,
            type: 'DEFAULT' | 'TRIAL' | undefined,
        ): PricingPlanScheduleInfoExpanded => ({
            id,
            start_at: '2024-01-01T00:00:00Z',
            end_at: '2024-12-31T23:59:59Z',
            pricing_plan_version_id: 'version-1',
            type,
            pricing_plan_version: {} as any,
            pricing_plan_schedule: {
                id,
                type,
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
            } as any,
        });

        it('should return the first schedule with matching type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'TRIAL'),
                createMockScheduleInfo('schedule-3', 'DEFAULT'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'DEFAULT',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-1');
            expect(result?.pricing_plan_schedule.type).toBe('DEFAULT');
        });

        it('should return the first TRIAL schedule when searching for TRIAL type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'TRIAL'),
                createMockScheduleInfo('schedule-3', 'TRIAL'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'TRIAL',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-2');
            expect(result?.pricing_plan_schedule.type).toBe('TRIAL');
        });

        it('should return undefined when no schedule matches the type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'DEFAULT'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'TRIAL',
            });

            expect(result).toBeUndefined();
        });

        it('should return undefined when searching for undefined type and no schedule has undefined type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'TRIAL'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: undefined,
            });

            expect(result).toBeUndefined();
        });

        it('should return the first schedule with undefined type when searching for undefined', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', undefined),
                createMockScheduleInfo('schedule-3', undefined),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: undefined,
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-2');
            expect(result?.pricing_plan_schedule.type).toBeUndefined();
        });

        it('should handle empty array', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'DEFAULT',
            });

            expect(result).toBeUndefined();
        });

        it('should only check pricing_plan_schedule.type, not the top-level type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                {
                    id: 'schedule-1',
                    start_at: '2024-01-01T00:00:00Z',
                    end_at: '2024-12-31T23:59:59Z',
                    pricing_plan_version_id: 'version-1',
                    type: 'TRIAL', // top-level type is TRIAL
                    pricing_plan_version: {} as any,
                    pricing_plan_schedule: {
                        id: 'schedule-1',
                        type: 'DEFAULT', // but pricing_plan_schedule.type is DEFAULT
                        start_at: '2024-01-01T00:00:00Z',
                        end_at: '2024-12-31T23:59:59Z',
                        pricing_plan_version_id: 'version-1',
                        pricing_plan_subscription_id: 'subscription-1',
                    } as any,
                },
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'DEFAULT',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-1');
            expect(result?.type).toBe('TRIAL'); // top-level type
            expect(result?.pricing_plan_schedule.type).toBe('DEFAULT'); // checked type
        });
    });

    describe('getScheduleCustomizations', () => {
        const createMockScheduleInfo = (
            id: string,
            type: 'DEFAULT' | 'TRIAL' | undefined,
        ): PricingPlanScheduleInfoExpanded => ({
            id,
            start_at: '2024-01-01T00:00:00Z',
            end_at: '2024-12-31T23:59:59Z',
            pricing_plan_version_id: 'version-1',
            type,
            pricing_plan_version: {} as any,
            pricing_plan_schedule: {
                id,
                type,
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
            } as any,
        });

        it('should return undefined when no DEFAULT schedule exists', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'TRIAL'),
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                enabledPricings: [{ pricing_id: 'pricing-1' }],
            });

            expect(result).toBeUndefined();
        });

        it('should return undefined when no enabledPricings and no seatsValues are provided', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
            });

            expect(result).toBeUndefined();
        });

        it('should return customizations with enabledPricings when provided', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];
            const enabledPricings: EnabledPricing[] = [
                { pricing_id: 'pricing-1', start_at: '2024-01-01T00:00:00Z' },
                { pricing_id: 'pricing-2' },
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                enabledPricings,
            });

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result?.[0].pricing_plan_schedule_id).toBe('schedule-1');
            expect(result?.[0].enabled_pricings).toEqual(enabledPricings);
            expect(result?.[0].seats_values).toBeUndefined();
        });

        it('should return customizations with seatsValues when provided', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];
            const seatsValues: ConfiguredMeterValue[] = [
                {
                    pricing_item_config_id: 'config-1',
                    number: '10',
                    amount: { quantity: '100', currency: 'USD' },
                    start_at: '2024-01-01T00:00:00Z',
                },
                {
                    pricing_item_config_id: 'config-2',
                    number: '5',
                },
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                seatsValues,
            });

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result?.[0].pricing_plan_schedule_id).toBe('schedule-1');
            expect(result?.[0].enabled_pricings).toBeUndefined();
            expect(result?.[0].seats_values).toEqual([
                { pricing_item_config_id: 'config-1', number: '10' },
                { pricing_item_config_id: 'config-2', number: '5' },
            ]);
        });

        it('should correctly map seatsValues to only include pricing_item_config_id and number', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];
            const seatsValues: ConfiguredMeterValue[] = [
                {
                    pricing_item_config_id: 'config-1',
                    number: '10',
                    amount: { quantity: '100', currency: 'USD' },
                    start_at: '2024-01-01T00:00:00Z',
                    end_at: '2024-12-31T23:59:59Z',
                    set_start_at_to_now: true,
                },
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                seatsValues,
            });

            expect(result?.[0].seats_values).toEqual([
                { pricing_item_config_id: 'config-1', number: '10' },
            ]);
            // Verify that other properties are not included
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('amount');
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('start_at');
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('end_at');
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('set_start_at_to_now');
        });
    });
});
