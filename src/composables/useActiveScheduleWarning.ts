import { computed, watch, type Ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { getActiveDefaultScheduleId } from '@/utils/pricingPlanSchedule';

/**
 * Warns when the customer has subscriptions but none of their schedules is billed right now: one-off
 * charges such as a wallet top-up are invoiced on that schedule, so they would have nowhere to go.
 */
export function useActiveScheduleWarning(
    subscriptions: Readonly<Ref<PricingPlanSubscriptionExpanded[]>>,
): void {
    const logger = useLogger();

    const activeScheduleId = computed(() => getActiveDefaultScheduleId(subscriptions.value));

    watch([activeScheduleId, subscriptions], ([scheduleId, activeSubscriptions]) => {
        if (scheduleId || activeSubscriptions.length === 0) {
            return;
        }

        logger.warn('ACTIVE_SCHEDULE_NOT_FOUND', 'No schedule is currently being billed', {
            schedules: activeSubscriptions.flatMap(({ pricing_plan_schedule_infos }) =>
                (pricing_plan_schedule_infos ?? []).map(
                    ({ id, type, start_at, end_at, ...info }) => ({
                        id,
                        type: info.pricing_plan_schedule?.type ?? type,
                        start_at,
                        end_at,
                    }),
                ),
            ),
        });
    });
}
