<script setup lang="ts">
import CustomerOverview from './CustomerOverview.vue';
import { COMPONENT_NAME } from './CustomerOverview.entry.ce';
import type { SolvimonCustomerOverviewEntryProps } from './CustomerOverview.entry.types';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonCustomerOverviewEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <CustomerOverview :configuration="configuration" />
    </EntryProvider>
</template>
