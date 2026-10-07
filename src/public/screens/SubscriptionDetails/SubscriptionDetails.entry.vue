<script setup lang="ts">
import type { SolvimonSubscriptionDetailsEntryProps } from './SubscriptionDetails.entry.types';
import SubscriptionDetails from './SubscriptionDetails.vue';
import SubscriptionDetailsEntryView from './SubscriptionDetails.entry.view.vue';
import { reportInvoiceCreated } from './SubscriptionDetails.lib';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('subscription-details');

const props = defineProps<SolvimonSubscriptionDetailsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <SubscriptionDetailsEntryView v-bind="$props">
            <template
                #default="{
                    subscription,
                    schedulesData,
                    customer,
                    paymentMethods,
                    walletBalances,
                    onDemandItems,
                    onDemandScheduleId,
                    hasWalletBalancesError,
                    isLoading,
                    error,
                    refreshWalletBalances,
                    refreshPaymentMethods,
                    refreshSubscription,
                }"
            >
                <SubscriptionDetails
                    :subscription="subscription"
                    :schedules-data="schedulesData"
                    :customer="customer"
                    :avatar="configuration.avatar"
                    :can-view-created-invoice="configuration.canViewCreatedInvoice"
                    :payment-methods="paymentMethods"
                    :wallet-balances="walletBalances"
                    :on-demand-items="onDemandItems"
                    :on-demand-schedule-id="onDemandScheduleId"
                    :has-wallet-balances-error="hasWalletBalancesError"
                    :is-loading="isLoading"
                    :error="error"
                    @top-up-charged="refreshWalletBalances"
                    @auto-top-up-saved="refreshWalletBalances"
                    @auto-top-up-cancelled="refreshWalletBalances"
                    @payment-method-stored="refreshPaymentMethods"
                    @subscription-changed="refreshSubscription"
                    @invoice-created="
                        (invoice) =>
                            reportInvoiceCreated({ invoice, configuration: props.configuration })
                    "
                />
            </template>
        </SubscriptionDetailsEntryView>
    </EntryProvider>
</template>
