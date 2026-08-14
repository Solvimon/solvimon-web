<script setup lang="ts">
import type { SolvimonSubscriptionDetailsEntryProps } from './SubscriptionDetails.entry.types';
import { COMPONENT_NAME } from './SubscriptionDetails.entry.ce';
import SubscriptionDetails from './SubscriptionDetails.vue';
import SubscriptionDetailsEntryView from './SubscriptionDetails.entry.view.vue';
import { Provider } from '@/components/providers';

defineProps<SolvimonSubscriptionDetailsEntryProps>();
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
        :css-overrides="cssOverrides"
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
                    @payment-method-stored="refreshPaymentMethods"
                    @subscription-changed="refreshSubscription"
                />
            </template>
        </SubscriptionDetailsEntryView>
    </Provider>
</template>
