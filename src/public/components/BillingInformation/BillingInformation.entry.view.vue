<script setup lang="ts">
import { COMPONENT_NAME } from './BillingInformation.entry.ce';
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import { Provider } from '@/components/providers';
import { useCustomer } from '@/composables/useCustomer';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';

defineProps<SolvimonBillingInformationEntryProps>();

const portal = usePortal();

const customerId = portal.value?.customer_id;

const customer = useCustomer({ customerId });
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
        <slot name="default" :customer="customer" />
    </Provider>
</template>
