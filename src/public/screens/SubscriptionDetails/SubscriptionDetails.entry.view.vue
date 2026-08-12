<script setup lang="ts">
import { computed } from 'vue';
import { ApiStatus } from '@solvimon/solvimon-types';
import type { SolvimonSubscriptionDetailsEntryProps } from './SubscriptionDetails.entry.types';
import { useSubscription } from '@/composables/useSubscription';
import { useCustomer } from '@/composables/useCustomer';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { useCustomerWalletBalances } from '@/composables/useCustomerWalletBalances';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonSubscriptionDetailsEntryProps>();

const customerId = props.portalObject.customer_id;

const {
    subscription,
    withPlanData,
    get: fetchSubscription,
    error,
} = useSubscription({ subscriptionId: props.configuration.subscriptionId });

const { customer, get: fetchCustomer } = useCustomer({ customerId });

const { items: paymentMethods, fetchAll: fetchPaymentMethods } = usePaymentMethods({ customerId });

const {
    walletBalances,
    apiStatus: walletBalancesApiStatus,
    fetch: fetchWalletBalances,
} = useCustomerWalletBalances({ customerId });

const { isLoading } = useLoadInitialData(
    fetchSubscription(),
    fetchCustomer.execute(),
    fetchPaymentMethods(),
    fetchWalletBalances(),
);

const schedulesData = computed(() =>
    subscription.value ? withPlanData(subscription.value) : [],
);

// Computed at the top level so the template unwraps the ref — nested access does not.
const walletBalanceItems = computed(() => walletBalances.value?.wallet_balances ?? []);

const hasWalletBalancesError = computed(() => walletBalancesApiStatus.value === ApiStatus.Failed);
</script>

<template>
    <slot
        name="default"
        :subscription="subscription"
        :schedules-data="schedulesData"
        :customer="customer"
        :payment-methods="paymentMethods"
        :wallet-balances="walletBalanceItems"
        :has-wallet-balances-error="hasWalletBalancesError"
        :is-loading="isLoading"
        :error="error"
        :refresh-wallet-balances="fetchWalletBalances"
        :refresh-payment-methods="fetchPaymentMethods"
    />
</template>
