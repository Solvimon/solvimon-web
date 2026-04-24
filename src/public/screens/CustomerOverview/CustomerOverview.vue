<script setup lang="ts">
import { computed } from 'vue';
import { ApiStatus } from '@solvimon/types';
import { useIntl, type WalletBalanceListItem } from '@solvimon/ui';
import type { CustomerOverviewProps } from './CustomerOverview.types';
import { ContentWithAsideLayout } from '@/layouts';
import InvoicesList from '@/public/components/InvoicesList/InvoicesList.vue';
import { useInvoicesList } from '@/composables/useInvoicesList';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
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

defineProps<CustomerOverviewProps>();

const portal = usePortal();

const customerId = portal.value?.customer_id;

const customer = useCustomer({ customerId });
const invoices = useInvoicesList({ customerId, batchSize: 5 });
const subscriptions = useSubscriptionsList({ customerId, batchSize: 2 });
const paymentMethods = usePaymentMethods({ customerId });
const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({ customerId });
const customerWalletBalances = useCustomerWalletBalances({ customerId });
const { $t } = useIntl();

const walletBalanceItems = computed<WalletBalanceListItem[]>(() =>
    (customerWalletBalances.walletBalances.value?.wallet_balances ?? []).map((walletBalance) => ({
        walletId: walletBalance.wallet_id,
        title: $t({
            defaultMessage: 'Balance',
            description: 'Fallback wallet title on the customer overview page',
            id: 'H5+NAX',
        }),
        balance: walletBalance.wallet_balance.open_balance,
        balanceAt:
            walletBalance.wallet_balance.balance_at ??
            customerWalletBalances.walletBalances.value?.balance_at ??
            null,
    })),
);

const { isLoading } = useLoadInitialData(
    customer.get.execute(),
    invoices.fetchInitial(),
    subscriptions.fetchInitial(),
    paymentMethods.fetchAll(),
    customerPaymentMethodOptions.fetch(),
    customerWalletBalances.fetch(),
);
</script>

<template>
    <ContentWithAsideLayout>
        <template #header>
            <SubscriptionsList
                v-if="customer.customer.value"
                :customer="customer.customer.value"
                :subscriptions="subscriptions.items.value"
                :payment-methods="paymentMethods.items.value"
                :is-loading="isLoading"
                :has-more-items="subscriptions.hasNextBatch.value"
                @load-more="subscriptions.fetchMore"
            />
        </template>
        <template #content>
            <InvoicesList
                :invoices="invoices.items.value"
                :has-more-items="invoices.hasNextBatch.value"
                :is-loading="isLoading"
                @load-more="invoices.fetchMore"
            />
        </template>
        <template #aside>
            <CustomerWalletBalances
                :has-error="customerWalletBalances.apiStatus.value === ApiStatus.Failed"
                :is-loading="isLoading"
                :wallet-balances="walletBalanceItems"
            />

            <CustomerPaymentMethods
                :is-loading="isLoading"
                :payment-methods="paymentMethods.items.value"
                :payment-methods-options="customerPaymentMethodOptions.items.value"
            />

            <BillingInformation
                v-if="customer.customer.value"
                :is-loading="isLoading"
                :customer="customer.customer.value"
                :payment-methods="paymentMethods.items.value"
            />
        </template>
    </ContentWithAsideLayout>
</template>
