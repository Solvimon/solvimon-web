<script setup lang="ts">
import BillingInformation from './BillingInformation.vue';
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import BillingInformationView from './BillingInformation.entry.view.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';
import LoadFailedNotice from '@/components/shared/LoadFailedNotice.vue';

const componentName = getComponentName('billing-information');

defineProps<SolvimonBillingInformationEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
    >
        <BillingInformationView v-bind="$props">
            <template #default="{ customer, isLoading }">
                <!-- Without the customer there is nothing to show but an empty card. -->
                <LoadFailedNotice
                    v-if="!isLoading && !customer.customer.value"
                    class="sv-billing-information"
                />
                <BillingInformation
                    v-else
                    :configuration="configuration"
                    :is-loading="isLoading"
                    :customer="customer.customer.value"
                />
            </template>
        </BillingInformationView>
    </EntryProvider>
</template>
