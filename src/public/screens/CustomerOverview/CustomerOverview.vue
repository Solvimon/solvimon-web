<script setup lang="ts">
import { ApiStatus } from '@solvimon/solvimon-types';
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
import { useWalletBalanceItems } from '@/composables/useWalletBalanceItems';

defineProps<CustomerOverviewProps>();

const portal = usePortal();

const customerId = portal.value?.customer_id;

const customer = useCustomer({ customerId });
const invoices = useInvoicesList({ customerId, batchSize: 5 });
const subscriptions = useSubscriptionsList({ customerId, batchSize: 2 });
const paymentMethods = usePaymentMethods({ customerId });
const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({ customerId });
const customerWalletBalances = useCustomerWalletBalances({ customerId });
const walletBalanceItems = useWalletBalanceItems(customerWalletBalances.walletBalances);

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
    <ContentWithAsideLayout class="sv-customer-overview sv-root sv-screen">
        <template #header>
            <SubscriptionsList
                v-if="customer.customer.value"
                class="sv-customer-overview__subscriptions"
                :customer="customer.customer.value"
                :subscriptions="subscriptions.items.value"
                :payment-methods="paymentMethods.items.value"
                :is-loading="isLoading"
                @load-more="subscriptions.fetchMore"
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
        </template>
    </ContentWithAsideLayout>
</template>
