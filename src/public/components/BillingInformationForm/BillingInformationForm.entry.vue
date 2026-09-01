<script setup lang="ts">
import BillingInformationForm from './BillingInformationForm.vue';
import BillingInformationFormEntryView from './BillingInformationForm.entry.view.vue';
import type {
    SolvimonBillingInformationFormEntryEmits,
    SolvimonBillingInformationFormEntryProps,
} from './BillingInformationForm.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('billing-information-form');

defineProps<SolvimonBillingInformationFormEntryProps>();
defineEmits<SolvimonBillingInformationFormEntryEmits>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <BillingInformationFormEntryView v-bind="$props">
            <template #default="{ customer, updateCustomer, isLoading, apiError }">
                <BillingInformationForm
                    v-if="customer"
                    :customer="customer"
                    :is-loading="isLoading"
                    :update-customer="({ payload }) => updateCustomer.execute(payload)"
                    :api-error="apiError"
                />
            </template>
        </BillingInformationFormEntryView>
    </EntryProvider>
</template>
