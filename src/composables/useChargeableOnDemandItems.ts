import { getChargeableOnDemandItems } from '@solvimon/solvimon-ui';
import { computed, watch, type Ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';
import { useService } from '@/composables/useService';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { getActiveDefaultScheduleInfo } from '@/utils/pricingPlanSchedule';

/**
 * The on-demand items a customer can order on a subscription, on the schedule it is billed on now.
 * Only a DEFAULT subscription is charged to its own customer, so the payment methods the customer
 * holds can pay for an order on it; any other variant has nothing to order.
 */
export function useChargeableOnDemandItems({
    subscription,
}: {
    subscription: Ref<PricingPlanSubscriptionExpanded | undefined>;
}) {
    const { getOnDemandPricingItems } = createPricingPlanSchedulesService();
    const logger = useLogger();

    const { data, execute, isPending, error } = useService({ service: getOnDemandPricingItems });

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
            ? getChargeableOnDemandItems(
                  data.value,
                  scheduleInfo.value?.pricing_plan_schedule?.pricing_currency,
              )
            : [],
    );

    return { items, scheduleId, isPending };
}
