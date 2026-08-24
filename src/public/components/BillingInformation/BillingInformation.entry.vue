<script setup lang="ts">
import BillingInformation from './BillingInformation.vue';
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import BillingInformationView from './BillingInformation.entry.view.vue';
import { COMPONENT_NAME } from './BillingInformation.entry.ce';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonBillingInformationEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <BillingInformationView v-bind="$props">
            <template #default="{ customer, isLoading }">
                <BillingInformation :is-loading="isLoading" :customer="customer.customer.value" />
            </template>
        </BillingInformationView>
    </EntryProvider>
</template>
