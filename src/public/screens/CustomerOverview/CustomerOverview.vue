<script setup lang="ts">
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

defineProps<CustomerOverviewProps>();

const portal = usePortal();

const customerId = portal.value?.customer_id;

const customer = useCustomer({ customerId });
const invoices = useInvoicesList({ customerId, batchSize: 5 });
const subscriptions = useSubscriptionsList({ customerId, batchSize: 2 });
const paymentMethods = usePaymentMethods({ customerId });
const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({ customerId });

const { isLoading } = useLoadInitialData(
    customer.fetch(),
    invoices.fetchInitial(),
    subscriptions.fetchInitial(),
    paymentMethods.fetchAll(),
    customerPaymentMethodOptions.fetch(),
);
</script>

<template>
    <ContentWithAsideLayout>
        <template #header>
            <SubscriptionsList
                v-if="customer.data.value"
                :customer="customer.data.value"
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
            <CustomerPaymentMethods
                :is-loading="isLoading"
                :payment-methods="paymentMethods.items.value"
                :payment-methods-options="customerPaymentMethodOptions.items.value"
            />

            <BillingInformation
                v-if="customer.data.value"
                :is-loading="isLoading"
                :customer="customer.data.value"
                :payment-methods="paymentMethods.items.value"
            />
        </template>
    </ContentWithAsideLayout>
</template>
