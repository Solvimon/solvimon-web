<script setup lang="ts">
import SubscriptionManagement from './SubscriptionManagement.vue';
import { COMPONENT_NAME } from './SubscriptionManagement.entry.ce';
import type { SolvimonSubscriptionManagementEntryProps } from './SubscriptionManagement.entry.types';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonSubscriptionManagementEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <SubscriptionManagement :configuration="configuration" />
    </EntryProvider>
</template>
