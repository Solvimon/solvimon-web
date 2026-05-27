<script setup lang="ts">
import InvoicesList from './InvoicesList.vue';
import type { SolvimonInvoicesListEntryProps } from './InvoicesList.entry.types';
import InvoicesListView from './InvoicesList.entry.view.vue';
import { COMPONENT_NAME } from './InvoicesList.entry.ce';
import { Provider } from '@/components/providers';

defineProps<SolvimonInvoicesListEntryProps>();
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
        <InvoicesListView v-bind="$props">
            <template #default="{ invoices, isLoading }">
                <InvoicesList
                    :configuration="configuration"
                    :invoices="invoices.items.value"
                    :is-loading="isLoading"
                    :has-more-items="invoices.hasNextBatch.value"
                    @load-more="invoices.fetchMore"
                />
            </template>
        </InvoicesListView>
    </Provider>
</template>
