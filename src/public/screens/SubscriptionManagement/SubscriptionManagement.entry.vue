<script setup lang="ts">
import SubscriptionManagement from './SubscriptionManagement.vue';
import type { SolvimonSubscriptionManagementEntryProps } from './SubscriptionManagement.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('subscription-management');

defineProps<SolvimonSubscriptionManagementEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <SubscriptionManagement :configuration="configuration" />
    </EntryProvider>
</template>
