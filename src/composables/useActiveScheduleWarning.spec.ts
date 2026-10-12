import { nextTick, ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { useActiveScheduleWarning } from './useActiveScheduleWarning';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: mockWarn, error: vi.fn() }),
}));

const DAY = 24 * 60 * 60 * 1000;

const subscriptionWith = (startAt: number, endAt?: number) =>
    ({
        id: 'sub_1',
        pricing_plan_schedule_infos: [
            {
                id: 'ppsc_1',
                type: 'DEFAULT',
                start_at: new Date(startAt).toISOString(),
                end_at: endAt ? new Date(endAt).toISOString() : undefined,
                pricing_plan_schedule: { type: 'DEFAULT' },
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('useActiveScheduleWarning', () => {
    beforeEach(() => {
        mockWarn.mockReset();
    });

    it('says nothing while no subscription has loaded', async () => {
        const subscriptions = ref<PricingPlanSubscriptionExpanded[]>([]);
        useActiveScheduleWarning(subscriptions);

        subscriptions.value = [];
        await nextTick();

        expect(mockWarn).not.toHaveBeenCalled();
    });

    it('says nothing when a schedule is billed right now', async () => {
        const subscriptions = ref<PricingPlanSubscriptionExpanded[]>([]);
        useActiveScheduleWarning(subscriptions);

        subscriptions.value = [subscriptionWith(Date.now() - DAY)];
        await nextTick();

        expect(mockWarn).not.toHaveBeenCalled();
    });

    it('warns with the schedules it found when none is billed right now', async () => {
        const subscriptions = ref<PricingPlanSubscriptionExpanded[]>([]);
        useActiveScheduleWarning(subscriptions);

        const startAt = Date.now() + DAY;
        subscriptions.value = [subscriptionWith(startAt)];
        await nextTick();

        expect(mockWarn).toHaveBeenCalledWith('ACTIVE_SCHEDULE_NOT_FOUND', expect.any(String), {
            schedules: [
                {
                    id: 'ppsc_1',
                    type: 'DEFAULT',
                    start_at: new Date(startAt).toISOString(),
                    end_at: undefined,
                },
            ],
        });
    });
});
