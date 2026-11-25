<script setup lang="ts">
import type { SolvimonSubscriptionPaymentAcceptorsEntryProps } from './SubscriptionPaymentAcceptors.entry.types';
import PaymentAcceptorsEntryView from '@/public/components/CustomerPaymentAcceptors/PaymentAcceptorsEntryView.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('subscription-payment-acceptors');

defineProps<SolvimonSubscriptionPaymentAcceptorsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        :required-configuration="{ subscriptionId: configuration?.subscriptionId }"
    >
        <PaymentAcceptorsEntryView
            :key="`${portalObject.customer_id}:${configuration.subscriptionId}`"
            :customer-id="portalObject.customer_id"
            :subscription-id="configuration.subscriptionId"
            :configuration="configuration"
        />
    </EntryProvider>
</template>
