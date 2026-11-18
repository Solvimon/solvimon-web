<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import type { SolvimonPaymentAcceptorFormEntryProps } from './PaymentAcceptorForm.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePaymentAcceptors } from '@/composables/usePaymentAcceptors';

const props = defineProps<SolvimonPaymentAcceptorFormEntryProps>();

const customerId = props.portalObject.customer_id;
const paymentAcceptorId = props.configuration?.paymentAcceptorId;

const paymentAcceptors = usePaymentAcceptors({ customerId });

/** Looked up once, as the form opens, so a save does not swap the form's starting values. */
const paymentAcceptor = shallowRef<PaymentAcceptor>();
const isPaymentAcceptorMissing = ref(false);
const hasLoadFailed = ref(false);

const loadPaymentAcceptor = async () => {
    await paymentAcceptors.fetchAll();

    // `fetchAll` reports its own failure; a list that did not load says nothing about the acceptor.
    if (paymentAcceptors.error.value) {
        hasLoadFailed.value = true;
        return;
    }

    paymentAcceptor.value = paymentAcceptors.items.value.find(({ id }) => id === paymentAcceptorId);
    isPaymentAcceptorMissing.value = !paymentAcceptor.value;
};

const { isLoading } = useLoadInitialData(...(paymentAcceptorId ? [loadPaymentAcceptor()] : []));
</script>

<template>
    <slot
        name="default"
        :payment-acceptor="paymentAcceptor"
        :is-payment-acceptor-missing="isPaymentAcceptorMissing"
        :has-load-failed="hasLoadFailed"
        :is-loading="isLoading"
        :actions="paymentAcceptors"
    />
</template>
