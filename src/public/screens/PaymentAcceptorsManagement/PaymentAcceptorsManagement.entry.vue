<script setup lang="ts">
import type { SolvimonPaymentAcceptorsManagementEntryProps } from './PaymentAcceptorsManagement.entry.types';
import PaymentAcceptorsManagement from './PaymentAcceptorsManagement.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('payment-acceptors-management');

defineProps<SolvimonPaymentAcceptorsManagementEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
    >
        <PaymentAcceptorsManagement :customer-id="portalObject.customer_id" />
    </EntryProvider>
</template>
