<script setup lang="ts">
import type { SolvimonSubscriptionDetailsEntryProps } from './SubscriptionDetails.entry.types';
import { COMPONENT_NAME } from './SubscriptionDetails.entry.ce';
import SubscriptionDetails from './SubscriptionDetails.vue';
import SubscriptionDetailsEntryView from './SubscriptionDetails.entry.view.vue';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonSubscriptionDetailsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
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
                    :payment-methods="paymentMethods"
                    :wallet-balances="walletBalances"
                    :has-wallet-balances-error="hasWalletBalancesError"
                    :is-loading="isLoading"
                    :error="error"
                    @top-up-charged="refreshWalletBalances"
                    @auto-top-up-saved="refreshWalletBalances"
                    @auto-top-up-cancelled="refreshWalletBalances"
                    @payment-method-stored="refreshPaymentMethods"
                    @subscription-changed="refreshSubscription"
                />
            </template>
        </SubscriptionDetailsEntryView>
    </EntryProvider>
</template>
