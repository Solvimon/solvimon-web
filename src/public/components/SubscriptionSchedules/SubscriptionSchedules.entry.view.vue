<script setup lang="ts">
import type { SolvimonSubscriptionSchedulesEntryProps } from './SubscriptionSchedules.entry.types';
import { useSubscription } from '@/composables/useSubscription';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { getSchedulesWithPlanData } from '@/utils/pricingPlanScheduleOverrides';

const props = defineProps<SolvimonSubscriptionSchedulesEntryProps>();

const { subscription, get } = useSubscription({
    subscriptionId: props.configuration.subscriptionId,
});

useLoadInitialData(get());
</script>

<template>
    <slot
        name="default"
        :schedules-data="subscription ? getSchedulesWithPlanData(subscription) : undefined"
    />
</template>
