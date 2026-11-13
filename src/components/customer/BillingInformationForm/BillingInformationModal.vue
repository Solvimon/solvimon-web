<script setup lang="ts">
import { computed, ref } from 'vue';
import { getApiError, Modal, useIntl } from '@solvimon/solvimon-ui';
import type { Customer } from '@solvimon/solvimon-types';
import BillingInformationForm from './BillingInformationForm.vue';
import type { useCustomer } from '@/composables/useCustomer';

const props = defineProps<{
    showModal: boolean;
    customer: Customer;
    /** Stores the changes and puts the stored customer in its place. */
    update: ReturnType<typeof useCustomer>['update'];
}>();

const emit = defineEmits<{ (e: 'close'): void }>();

const { $t } = useIntl();

const formRef = ref<InstanceType<typeof BillingInformationForm>>();

const apiError = computed(() =>
    props.update.error.value ? getApiError(props.update.error.value) : undefined,
);

const handleClose = () => {
    if (formRef.value?.isSubmitting) return;
    emit('close');
};
</script>

<template>
    <Modal
        no-click-away
        size="lg"
        :show-modal="showModal"
        :title="
            $t({
                defaultMessage: 'Edit billing information',
                id: 'billing_information_modal.title',
                description:
                    'Title of the modal in which the customer edits their billing information',
            })
        "
        :confirm-button-text="
            $t({
                defaultMessage: 'Save changes',
                id: 'billing_information_form.submit_button.label',
                description: 'The label for the submit button of the billing information form',
            })
        "
        :cancel-button-text="
            $t({
                defaultMessage: 'Cancel',
                id: 'billing_information_modal.cancel_button.label',
                description:
                    'Label of the button that closes the billing information modal unsaved',
            })
        "
        :is-loading="formRef?.isSubmitting"
        @confirm="formRef?.submit()"
        @close="handleClose"
    >
        <template #body>
            <!-- Built afresh on every open, so edits given up on do not come back. -->
            <BillingInformationForm
                v-if="showModal"
                ref="formRef"
                class="sv-billing-information-modal pb-4"
                hide-submit-button
                :customer="customer"
                :is-loading="update.isPending.value"
                :api-error="apiError"
                :update-customer="({ payload }) => update.execute(payload)"
                @saved="$emit('close')"
            />
        </template>
    </Modal>
</template>
