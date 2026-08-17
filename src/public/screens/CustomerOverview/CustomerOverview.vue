<script setup lang="ts">
import { ApiStatus } from '@solvimon/solvimon-types';
import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import { computed, ref, watch } from 'vue';
import type { CustomerOverviewProps } from './CustomerOverview.types';
import { ContentWithAsideLayout } from '@/layouts';
import InvoicesList from '@/public/components/InvoicesList/InvoicesList.vue';
import { useInvoicesList } from '@/composables/useInvoicesList';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { useLogger } from '@/components/providers';
import { useSubscriptionsList } from '@/composables/useSubscriptionsList';
import { useCustomer } from '@/composables/useCustomer';
import SubscriptionsList from '@/public/components/SubscriptionsList/SubscriptionsList.vue';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import BillingInformation from '@/public/components/BillingInformation/BillingInformation.vue';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import CustomerPaymentMethods from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.vue';
import { useCustomerPaymentMethodOptions } from '@/composables/useCustomerPaymentMethodOptions';
import { useCustomerWalletBalances } from '@/composables/useCustomerWalletBalances';
import CustomerWalletBalances from '@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue';
import TopUpModal from '@/components/wallets/TopUpModal/TopUpModal.vue';
import { useTopUpModal } from '@/components/wallets/TopUpModal/useTopUpModal';
import { getActiveDefaultScheduleId } from '@/utils/pricingPlanSchedule';

defineProps<CustomerOverviewProps>();

const portal = usePortal();
const logger = useLogger();

const customerId = portal.value?.customer_id;

const customer = useCustomer({ customerId });
const invoices = useInvoicesList({ customerId, batchSize: 5 });
/**
 * How many subscriptions the block shows. Every active one is loaded — the top-up modal needs the
 * full set to work out which subscription a wallet is topped up for — but the block itself stays a
 * summary, with "View all" leading to the rest.
 */
const SUBSCRIPTIONS_SHOWN = 2;

const subscriptions = useSubscriptionsList({ customerId });
const paymentMethods = usePaymentMethods({ customerId });
const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({ customerId });
const customerWalletBalances = useCustomerWalletBalances({ customerId });
// Computed at the top level so the template unwraps the ref — nested access does not.
const walletBalanceItems = computed(
    () => customerWalletBalances.walletBalances.value?.wallet_balances ?? [],
);

const shownSubscriptions = computed(() => subscriptions.items.value.slice(0, SUBSCRIPTIONS_SHOWN));

const { isLoading } = useLoadInitialData(
    customer.get.execute(),
    invoices.fetchInitial(),
    subscriptions.fetchAll(),
    paymentMethods.fetchAll(),
    customerPaymentMethodOptions.fetch(),
    customerWalletBalances.fetch(),
);

/**
 * A payment method added from the top-up modal is not in the list yet, so reload it — the modal picks
 * the new one up from the refreshed list.
 */
const handlePaymentMethodStored = () => {
    void paymentMethods.fetchAll();
};

/** The top-up was charged, so the balance it credited is out of date. */
const handleTopUpCharged = () => {
    void customerWalletBalances.fetch();
};

/** One-off charges such as a wallet top-up are invoiced on the schedule billed right now. */
const activeScheduleId = computed(() => getActiveDefaultScheduleId(subscriptions.items.value));

// Without a schedule a top-up can be entered but never previewed or charged, so report what the
// customer's subscriptions offered when none of them qualifies.
watch([activeScheduleId, () => subscriptions.items.value], ([scheduleId, activeSubscriptions]) => {
    if (scheduleId || activeSubscriptions.length === 0) {
        return;
    }

    logger.warn('ACTIVE_SCHEDULE_NOT_FOUND', 'No schedule is currently being billed', {
        schedules: activeSubscriptions.flatMap(({ pricing_plan_schedule_infos }) =>
            (pricing_plan_schedule_infos ?? []).map(({ id, type, start_at, end_at, ...info }) => ({
                id,
                type: info.pricing_plan_schedule?.type ?? type,
                start_at,
                end_at,
            })),
        ),
    });
});

const selectedBalanceItem = ref<CustomerWalletBalanceItem | undefined>();

const topUpModal = useTopUpModal(selectedBalanceItem);
</script>

<template>
    <ContentWithAsideLayout class="sv-customer-overview sv-root sv-screen">
        <template #header>
            <SubscriptionsList
                v-if="customer.customer.value"
                class="sv-customer-overview__subscriptions"
                :customer="customer.customer.value"
                :subscriptions="shownSubscriptions"
                :payment-methods="paymentMethods.items.value"
                :is-loading="isLoading"
            />
        </template>
        <template #content>
            <InvoicesList
                class="sv-customer-overview__invoices"
                :invoices="invoices.items.value"
                :has-more-items="invoices.hasNextBatch.value"
                :is-loading="isLoading"
                @load-more="invoices.fetchMore"
            />
        </template>
        <template #aside>
            <CustomerWalletBalances
                class="sv-customer-overview__wallet-balances"
                :has-error="customerWalletBalances.apiStatus.value === ApiStatus.Failed"
                :is-loading="isLoading"
                :wallet-balances="walletBalanceItems"
                show-top-up-button
                @top-up="selectedBalanceItem = $event"
            />

            <CustomerPaymentMethods
                class="sv-customer-overview__payment-methods"
                :is-loading="isLoading"
                :payment-methods="paymentMethods.items.value"
            />

            <BillingInformation
                v-if="customer.customer.value"
                class="sv-customer-overview__billing-information"
                :is-loading="isLoading"
                :customer="customer.customer.value"
            />

            <TopUpModal
                :show-modal="topUpModal.showModal.value"
                :payment-methods="paymentMethods.items.value"
                :customer="customer.customer.value"
                :selected-balance-item="selectedBalanceItem"
                :subscriptions="subscriptions.items.value"
                @close="selectedBalanceItem = undefined"
                @confirm="handleTopUpCharged"
                @payment-success="handlePaymentMethodStored"
            />
        </template>
    </ContentWithAsideLayout>
</template>
