<script setup lang="ts">
import { computed } from 'vue';
import { ApiStatus } from '@solvimon/solvimon-types';
import type { SolvimonSubscriptionDetailsEntryProps } from './SubscriptionDetails.entry.types';
import { useSubscription } from '@/composables/useSubscription';
import { useCustomer } from '@/composables/useCustomer';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { useCustomerWalletBalances } from '@/composables/useCustomerWalletBalances';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useChargeableOnDemandItems } from '@/composables/useChargeableOnDemandItems';
import { useLogger } from '@/components/providers';

const props = defineProps<SolvimonSubscriptionDetailsEntryProps>();

const customerId = props.portalObject.customer_id;

const {
    subscription,
    withPlanData,
    get: fetchSubscription,
    error,
} = useSubscription({ subscriptionId: props.configuration.subscriptionId });

const logger = useLogger();

/** A failed reload keeps the subscription already on screen; only a failed first load replaces it. */
const loadError = computed(() => (subscription.value ? null : error.value));

const refreshSubscription = () =>
    fetchSubscription().catch((refreshError: unknown) => {
        logger.error(
            'SUBSCRIPTION_LOAD_FAILED',
            'Failed to reload the subscription after it changed',
            {},
            refreshError,
        );
    });

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

const { items: onDemandItems, scheduleId: onDemandScheduleId } = useChargeableOnDemandItems({
    subscription,
});

const schedulesData = computed(() => (subscription.value ? withPlanData(subscription.value) : []));

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
        :on-demand-items="onDemandItems"
        :on-demand-schedule-id="onDemandScheduleId"
        :has-wallet-balances-error="hasWalletBalancesError"
        :is-loading="isLoading"
        :error="loadError"
        :refresh-wallet-balances="fetchWalletBalances"
        :refresh-payment-methods="fetchPaymentMethods"
        :refresh-subscription="refreshSubscription"
    />
</template>
