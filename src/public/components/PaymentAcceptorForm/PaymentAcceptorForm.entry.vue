<script setup lang="ts">
import PaymentAcceptorForm from './PaymentAcceptorForm.vue';
import PaymentAcceptorFormEntryView from './PaymentAcceptorForm.entry.view.vue';
import type { SolvimonPaymentAcceptorFormEntryProps } from './PaymentAcceptorForm.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('payment-acceptor-form');

defineProps<SolvimonPaymentAcceptorFormEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
    >
        <PaymentAcceptorFormEntryView v-bind="$props">
            <template
                #default="{
                    paymentAcceptor,
                    isPaymentAcceptorMissing,
                    hasLoadFailed,
                    isLoading,
                    actions,
                }"
            >
                <PaymentAcceptorForm
                    :payment-acceptor="paymentAcceptor"
                    :is-payment-acceptor-missing="isPaymentAcceptorMissing"
                    :has-load-failed="hasLoadFailed"
                    :is-loading="isLoading"
                    :actions="actions"
                />
            </template>
        </PaymentAcceptorFormEntryView>
    </EntryProvider>
</template>
