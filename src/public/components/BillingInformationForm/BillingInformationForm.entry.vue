<script setup lang="ts">
import BillingInformationForm from './BillingInformationForm.vue';
import BillingInformationFormEntryView from './BillingInformationForm.entry.view.vue';
import type {
    SolvimonBillingInformationFormEntryEmits,
    SolvimonBillingInformationFormEntryProps,
} from './BillingInformationForm.entry.types';
import { COMPONENT_NAME } from './BillingInformationForm.entry.ce';
import { Provider } from '@/components/providers';

defineProps<SolvimonBillingInformationFormEntryProps>();
defineEmits<SolvimonBillingInformationFormEntryEmits>();
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
        :css-overrides="cssOverrides"
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
    </Provider>
</template>
