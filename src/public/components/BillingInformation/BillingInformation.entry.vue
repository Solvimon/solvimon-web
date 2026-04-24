<script setup lang="ts">
import BillingInformation from './BillingInformation.vue';
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import BillingInformationView from './BillingInformation.entry.view.vue';
import { COMPONENT_NAME } from './BillingInformation.entry.ce';
import { Provider } from '@/components/providers';

defineProps<SolvimonBillingInformationEntryProps>();
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
        @error="(error) => $emit('error', error)"
    >
        <BillingInformationView v-bind="$props">
            <template #default="{ customer }">
                <BillingInformation
                    v-if="customer.customer.value"
                    :is-loading="customer.get.isPending.value"
                    :customer="customer.customer.value"
                />
            </template>
        </BillingInformationView>
    </Provider>
</template>
