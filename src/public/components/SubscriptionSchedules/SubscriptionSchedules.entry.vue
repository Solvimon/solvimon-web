<script setup lang="ts">
import type { SolvimonSubscriptionSchedulesEntryProps } from './SubscriptionSchedules.entry.types';
import { COMPONENT_NAME } from './SubscriptionSchedules.entry.ce';
import SubscriptionSchedules from './SubscriptionSchedules.vue';
import SubscriptionSchedulesEntryView from './SubscriptionSchedules.entry.view.vue';
import { Provider } from '@/components/providers';

const props = defineProps<SolvimonSubscriptionSchedulesEntryProps>();
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
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
    </Provider>
</template>
