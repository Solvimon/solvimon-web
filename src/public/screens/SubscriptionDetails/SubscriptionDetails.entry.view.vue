<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonSubscriptionDetailsEntryProps } from './SubscriptionDetails.entry.types';
import { useSubscription } from '@/composables/useSubscription';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonSubscriptionDetailsEntryProps>();

const {
    subscription,
    withPlanData,
    get: fetchSubscription,
    error,
} = useSubscription({ subscriptionId: props.configuration.subscriptionId });

const { isLoading } = useLoadInitialData(fetchSubscription());

const schedulesData = computed(() =>
    subscription.value ? withPlanData(subscription.value) : [],
);
</script>

<template>
    <slot
        name="default"
        :subscription="subscription"
        :schedules-data="schedulesData"
        :is-loading="isLoading"
        :error="error"
    />
</template>
