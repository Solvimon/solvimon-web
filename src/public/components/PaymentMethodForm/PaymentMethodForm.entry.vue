<script setup lang="ts">
import { COMPONENT_NAME } from './PaymentMethodForm.entry.ce';
import type { SolvimonPaymentMethodFormEntryProps } from './PaymentMethodForm.entry.types';
import PaymentMethodFormEntryView from './PaymentMethodForm.entry.view.vue';
import PaymentMethodForm from './PaymentMethodForm.vue';
import { EntryProvider } from '@/components/providers';

const props = defineProps<SolvimonPaymentMethodFormEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error: Error) => $emit('error', error)"
    >
        <PaymentMethodFormEntryView v-bind="props">
            <template #default="{ customer, paymentMethodOptions, isLoading }">
                <PaymentMethodForm
                    v-if="customer"
                    :customer="customer"
                    :payment-method-options="paymentMethodOptions.paymentMethodOptions.value"
                    :configuration="configuration"
                    :is-loading="isLoading"
                />
            </template>
        </PaymentMethodFormEntryView>
    </EntryProvider>
</template>
