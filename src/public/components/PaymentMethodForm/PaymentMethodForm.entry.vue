<script setup lang="ts">
import type { SolvimonPaymentMethodFormEntryProps } from './PaymentMethodForm.entry.types';
import PaymentMethodFormEntryView from './PaymentMethodForm.entry.view.vue';
import PaymentMethodForm from './PaymentMethodForm.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('payment-method-form');

const props = defineProps<SolvimonPaymentMethodFormEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
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
