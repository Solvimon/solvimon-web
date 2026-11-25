<script setup lang="ts">
import type { SolvimonCustomerPaymentAcceptorsEntryProps } from './CustomerPaymentAcceptors.entry.types';
import PaymentAcceptorsEntryView from './PaymentAcceptorsEntryView.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('customer-payment-acceptors');

defineProps<SolvimonCustomerPaymentAcceptorsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
    >
        <PaymentAcceptorsEntryView
            :key="portalObject.customer_id"
            :customer-id="portalObject.customer_id"
            :configuration="configuration"
        />
    </EntryProvider>
</template>
