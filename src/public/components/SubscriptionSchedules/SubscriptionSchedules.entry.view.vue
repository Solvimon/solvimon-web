<script setup lang="ts">
import type { SolvimonSubscriptionSchedulesEntryProps } from './SubscriptionSchedules.entry.types';
import { useSubscription } from '@/composables/useSubscription';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonSubscriptionSchedulesEntryProps>();

const { subscription, withPlanData, get } = useSubscription({
    subscriptionId: props.configuration.subscriptionId,
});

const { isLoading } = useLoadInitialData(get());
</script>

<template>
    <slot
        name="default"
        :schedules-data="subscription ? withPlanData(subscription) : undefined"
        :is-loading="isLoading"
    />
</template>
