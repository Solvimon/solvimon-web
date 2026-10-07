import { computed, watch, type Ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';
import { useService } from '@/composables/useService';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { getActiveDefaultScheduleInfo } from '@/utils/pricingPlanSchedule';
import { getChargeableOnDemandItems } from '@/utils/chargeOnDemand';

export function useChargeableOnDemandItems({
    subscription,
}: {
    subscription: Ref<PricingPlanSubscriptionExpanded | undefined>;
}) {
    const { getOnDemandPricingItems } = createPricingPlanSchedulesService();
    const logger = useLogger();

    const { data, execute, error } = useService({ service: getOnDemandPricingItems });

    const scheduleInfo = computed(() =>
        subscription.value?.variant === 'DEFAULT'
            ? getActiveDefaultScheduleInfo(subscription.value.pricing_plan_schedule_infos)
            : undefined,
    );

    const scheduleId = computed(() => scheduleInfo.value?.id);

    watch(
        scheduleId,
        (id) => {
            if (!id) return;

            execute({ scheduleId: id }).catch(() =>
                logger.error(
                    'ON_DEMAND_ITEMS_LOAD_FAILED',
                    'Failed to load the on-demand items of the subscription',
                    { scheduleId: id },
                    error.value,
                ),
            );
        },
        { immediate: true },
    );

    const items = computed(() =>
        scheduleId.value && data.value?.pricing_plan_schedule_id === scheduleId.value
            ? getChargeableOnDemandItems(data.value, {
                  pricingPlanVersions: subscription.value?.pricing_plan_schedule_infos.map(
                      (info) => info.pricing_plan_version,
                  ),
              })
            : [],
    );

    return { items, scheduleId };
}
