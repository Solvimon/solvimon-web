<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
    AddPaymentMethodPaneEmits,
    AddPaymentMethodPaneProps,
} from './AddPaymentMethodPane.types';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.vue';
import type { TokenizePaymentMethodFormConfiguration } from '@/public/components/PaymentMethodForm/PaymentMethodForm.types';

const props = defineProps<AddPaymentMethodPaneProps>();
defineEmits<AddPaymentMethodPaneEmits>();

/**
 * Adding a method here only stores it — whatever the host is charging is charged separately, against
 * the method chosen afterwards — so the form runs the tokenization flow rather than taking a payment.
 */
const configuration = computed<TokenizePaymentMethodFormConfiguration>(() => ({
    variant: 'TOKENIZE',
}));

/**
 * Built the first time the pane is shown and kept from then on. A host that slides between panes keeps
 * them all mounted, and the form starts up a payment gateway — not worth doing for a customer who
 * never comes here.
 */
const hasEverBeenActive = ref(false);

watch(
    () => props.isActive,
    (isActive) => {
        hasEverBeenActive.value = hasEverBeenActive.value || !!isActive;
    },
    { immediate: true },
);

const formRef = ref<InstanceType<typeof PaymentMethodForm>>();

defineExpose({
    /** Submits the form, for a host whose own chrome owns the button — a modal footer, say. */
    submit: () => formRef.value?.submit(),
    /**
     * Whether the gateway is working on it, so the host can show it and hold everything else. Read
     * through the pane being on screen: a form left behind on another pane is not what is pending.
     */
    isSaving: computed(() => !!props.isActive && !!formRef.value?.isPaymentPending),
});
</script>

<template>
    <PaymentMethodForm
        v-if="customer && hasEverBeenActive"
        ref="formRef"
        class="sv-add-payment-method-pane"
        hide-submit-button
        :customer="customer"
        :payment-method-options="paymentMethodOptions ?? []"
        :is-loading="isLoading"
        :configuration="configuration"
        @success="$emit('success')"
        @failure="(error) => $emit('failure', error)"
    />
</template>
