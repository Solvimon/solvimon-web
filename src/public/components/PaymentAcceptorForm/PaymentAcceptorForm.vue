<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button, ErrorNotification, useIntl } from '@solvimon/solvimon-ui';
import type { FormFieldError, PaymentAcceptor } from '@solvimon/solvimon-types';
import InternalPaymentAcceptorForm from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.vue';
import LoadFailedNotice from '@/components/shared/LoadFailedNotice.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useLogger } from '@/components/providers';
import { useHostEvent } from '@/components/providers/HostElementProvider/composables/useHostEvent';
import type { UsePaymentAcceptors } from '@/composables/usePaymentAcceptors';
import { getRefusedShownField } from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.lib';
import { usePaymentAcceptorErrorMessages } from '@/composables/usePaymentAcceptorErrorMessages';

const props = defineProps<{
    /** The bank account being edited; left out, a new one is added. */
    paymentAcceptor?: PaymentAcceptor;
    /** Set when the bank account to edit is not among the customer's. */
    isPaymentAcceptorMissing?: boolean;
    /** Set when the customer's bank accounts could not be loaded. */
    hasLoadFailed?: boolean;
    isLoading?: boolean;
    actions: Pick<UsePaymentAcceptors, 'create' | 'update'>;
}>();

const { $t } = useIntl();
const logger = useLogger();
const { fieldRefused } = usePaymentAcceptorErrorMessages();
const { dispatch, componentName } = useHostEvent();

const formRef = ref<InstanceType<typeof InternalPaymentAcceptorForm>>();
const isSaving = ref(false);
const hasSaveFailed = ref(false);
const apiError = ref<FormFieldError>();

/** The acceptor the next save changes: the one edited, or the one this form added already. */
const saved = ref<PaymentAcceptor>();
const target = computed(() => saved.value ?? props.paymentAcceptor);

const save = async () => {
    // A second save while the first is out would store the bank account twice.
    if (isSaving.value) return;

    isSaving.value = true;
    hasSaveFailed.value = false;
    apiError.value = undefined;

    try {
        const filledIn = await formRef.value?.submit();
        if (!filledIn) return;

        const editing = target.value;
        const result =
            filledIn.method === 'UPDATE' && editing
                ? await props.actions.update(editing, filledIn.payload)
                : filledIn.method === 'CREATE'
                  ? await props.actions.create(filledIn.details)
                  : undefined;

        if (!result) return;

        saved.value = result;
        dispatch('solvimon-payment-acceptor-saved', {
            componentName,
            paymentAcceptorId: result.id,
        });
    } catch (error) {
        logger.error(
            'PAYMENT_ACCEPTOR_SAVE_FAILED',
            'Failed to save the payment acceptor',
            {},
            error,
        );
        const refusedField = getRefusedShownField(error);
        if (refusedField) {
            apiError.value = { [refusedField]: fieldRefused() };
        } else {
            hasSaveFailed.value = true;
        }
    } finally {
        isSaving.value = false;
    }
};
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-payment-acceptor-form sv-root sv-component sv-loading min-h-[200px]"
    />
    <LoadFailedNotice
        v-else-if="hasLoadFailed"
        class="sv-payment-acceptor-form sv-root sv-component"
    />
    <ErrorNotification
        v-else-if="isPaymentAcceptorMissing"
        class="sv-payment-acceptor-form sv-root sv-component sv-error"
        :title="
            $t({
                defaultMessage: 'We could not find this payment acceptor.',
                id: 'components.payment_acceptor_form.not_found',
                description:
                    'Shown instead of the payment acceptor form when the bank account to edit is not among the customer’s',
            })
        "
    />
    <form v-else class="sv-payment-acceptor-form sv-root sv-component" @submit.prevent="save">
        <!-- Keyed on what it edits, so the form starts over from the acceptor a save stored. -->
        <InternalPaymentAcceptorForm
            ref="formRef"
            :key="target?.id ?? 'new'"
            :payment-acceptor="target"
            :disabled="isSaving"
            :api-error="apiError"
        />

        <ErrorNotification
            v-if="hasSaveFailed"
            class="sv-error mt-4"
            :title="
                $t({
                    defaultMessage: 'Something went wrong. Please try again.',
                    id: 'payment_acceptors_modal.error',
                    description:
                        'Error shown in the payment acceptors modal when a change cannot be made',
                })
            "
        />

        <Button
            type="submit"
            intent="primary"
            :loading="isSaving"
            class="sv-action sv-action--primary sv-payment-acceptor-form__save mt-4"
            >{{
                $t({
                    defaultMessage: 'Save',
                    id: 'payment_acceptors_modal.save_button.label',
                    description: 'Label of the button that stores a new or changed bank account',
                })
            }}</Button
        >
    </form>
</template>
