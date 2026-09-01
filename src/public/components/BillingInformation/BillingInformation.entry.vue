<script setup lang="ts">
import BillingInformation from './BillingInformation.vue';
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import BillingInformationView from './BillingInformation.entry.view.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('billing-information');

defineProps<SolvimonBillingInformationEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <BillingInformationView v-bind="$props">
            <template #default="{ customer, isLoading }">
                <BillingInformation
                    :configuration="configuration"
                    :is-loading="isLoading"
                    :customer="customer.customer.value"
                />
            </template>
        </BillingInformationView>
    </EntryProvider>
</template>
