<script setup lang="ts">
import type { SolvimonSubscriptionSchedulesEntryProps } from './SubscriptionSchedules.entry.types';
import { COMPONENT_NAME } from './SubscriptionSchedules.entry.ce';
import SubscriptionSchedules from './SubscriptionSchedules.vue';
import SubscriptionSchedulesEntryView from './SubscriptionSchedules.entry.view.vue';
import { EntryProvider } from '@/components/providers';

const props = defineProps<SolvimonSubscriptionSchedulesEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error: Error) => $emit('error', error)"
    >
        <SubscriptionSchedulesEntryView v-bind="props">
            <template #default="{ schedulesData, isLoading }">
                <SubscriptionSchedules
                    v-if="schedulesData"
                    :schedules-data="schedulesData"
                    :is-loading="isLoading"
                    :configuration="configuration"
                />
            </template>
        </SubscriptionSchedulesEntryView>
    </EntryProvider>
</template>
