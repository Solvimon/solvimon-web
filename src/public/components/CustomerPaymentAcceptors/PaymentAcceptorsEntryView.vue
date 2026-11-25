<script setup lang="ts">
import { computed } from 'vue';
import { ErrorNotification, useIntl } from '@solvimon/solvimon-ui';
import CustomerPaymentAcceptors from './CustomerPaymentAcceptors.vue';
import type { PaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';
import { useCustomer } from '@/composables/useCustomer';
import { useSubscription } from '@/composables/useSubscription';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import LoadFailedNotice from '@/components/shared/LoadFailedNotice.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

const props = defineProps<{
    customerId: string;
    subscriptionId?: string;
    configuration?: PaymentAcceptorsConfiguration;
}>();

const { $t } = useIntl();
const { customer, get } = useCustomer({ customerId: props.customerId });
const subscriptionData = props.subscriptionId
    ? useSubscription({ subscriptionId: props.subscriptionId })
    : undefined;
const { isLoading } = useLoadInitialData(
    get.execute(),
    ...(subscriptionData ? [subscriptionData.get()] : []),
);

const subscription = computed(() => subscriptionData?.subscription.value);
const hasSelfBillingRole = computed(() => customer.value?.roles?.includes('SELF_BILLING') ?? false);
const hasLoadFailed = computed(() => !!get.error.value || !!subscriptionData?.error.value);
const isEligible = computed(() =>
    props.subscriptionId
        ? subscription.value?.variant === 'SELF_BILLING' &&
          subscription.value.customer_id === props.customerId
        : hasSelfBillingRole.value,
);
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-payment-acceptors sv-root sv-component sv-loading min-h-[100px]"
    />
    <LoadFailedNotice v-else-if="hasLoadFailed" class="sv-payment-acceptors sv-root sv-component" />
    <CustomerPaymentAcceptors
        v-else-if="isEligible"
        :customer-id="customerId"
        :subscription="subscription"
        :max-items="configuration?.maxItems"
        :management="hasSelfBillingRole ? configuration?.management : 'read-only'"
    />
    <ErrorNotification
        v-else
        class="sv-payment-acceptors sv-root sv-component sv-error"
        :title="
            $t({
                id: 'payment_acceptors.unavailable',
                defaultMessage: 'Payment acceptors are unavailable here.',
                description:
                    'Shown when the customer or subscription is not eligible for self-billing payment acceptors',
            })
        "
    />
</template>
