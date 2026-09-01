<script setup lang="ts">
import CustomerOverview from './CustomerOverview.vue';
import type { SolvimonCustomerOverviewEntryProps } from './CustomerOverview.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('customer-overview');

defineProps<SolvimonCustomerOverviewEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <CustomerOverview :configuration="configuration" />
    </EntryProvider>
</template>
