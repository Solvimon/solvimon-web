<script setup lang="ts">
import { COMPONENT_NAME } from './InvoicesList.entry.ce';
import type { SolvimonInvoicesListEntryProps } from './InvoicesList.entry.types';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { useInvoicesList } from '@/composables/useInvoicesList';
import { Provider } from '@/components/providers';

defineProps<SolvimonInvoicesListEntryProps>();

const portal = usePortal();

const customerId = portal.value?.customer_id;

const invoices = useInvoicesList({ customerId, batchSize: 10 });
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :token="token || portal?.token"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        @error="(error) => $emit('error', error)"
    >
        <slot name="default" :invoices="invoices" />
    </Provider>
</template>
