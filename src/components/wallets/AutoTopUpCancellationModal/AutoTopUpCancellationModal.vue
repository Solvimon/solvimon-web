<script setup lang="ts">
import { ErrorNotification, Modal, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type {
    AutoTopUpCancellationModalEmits,
    AutoTopUpCancellationModalProps,
} from './AutoTopUpCancellationModal.types';
import { createAutoTopUpConfigsService } from '@/services/autoTopUpConfigs';
import { useWalletBalanceFormat } from '@/composables/useWalletBalanceFormat';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const props = defineProps<AutoTopUpCancellationModalProps>();
const emit = defineEmits<AutoTopUpCancellationModalEmits>();

const { $t } = useIntl();
const logger = useLogger();
const { formatValue } = useWalletBalanceFormat();

const { deactivateAutoTopUpConfig } = createAutoTopUpConfigsService();

const isSubmitting = ref(false);
const hasFailed = ref(false);

watch(
    () => props.showModal,
    (showModal) => {
        if (showModal) {
            hasFailed.value = false;
        }
    },
);

const explanation = computed(() => {
    const threshold = props.config?.threshold;
    const topUpAmount = props.config?.topup_amount;

    if (!threshold?.amount && !threshold?.credits) {
        return $t({
            defaultMessage:
                'Your balance will no longer be topped up automatically. You can still top up whenever you want to.',
            description: 'Explanation in the modal that turns a wallet automatic top-up off',
            id: 'auto_topup_cancellation_modal.explanation',
        });
    }

    if (!topUpAmount) {
        return $t(
            {
                defaultMessage:
                    'Your balance will no longer be topped up automatically when it falls below {threshold}. You can still top up whenever you want to.',
                description:
                    'Explanation in the modal that turns a wallet automatic top-up off, naming the threshold',
                id: 'auto_topup_cancellation_modal.explanation_with_threshold',
            },
            { threshold: formatValue(threshold) },
        );
    }

    return $t(
        {
            defaultMessage:
                'Your balance will no longer be topped up with {amount} when it falls below {threshold}. You can still top up whenever you want to.',
            description:
                'Explanation in the modal that turns a wallet automatic top-up off, naming what it charged and when',
            id: 'auto_topup_cancellation_modal.explanation_with_amount',
        },
        { amount: formatValue({ amount: topUpAmount }), threshold: formatValue(threshold) },
    );
});

const handleConfirm = async () => {
    const configId = props.config?.id;

    if (!configId || isSubmitting.value) {
        return;
    }

    isSubmitting.value = true;
    hasFailed.value = false;

    try {
        await deactivateAutoTopUpConfig(configId);

        emit('confirmed');
        emit('close');
    } catch (error) {
        logger.error(
            'AUTO_TOP_UP_CANCELLATION_FAILED',
            "Failed to turn off a wallet's automatic top-up",
            {},
            error,
        );
        hasFailed.value = true;
    } finally {
        isSubmitting.value = false;
    }
};

const handleClose = () => {
    // The request is already out, so there is nothing left to back out of.
    if (isSubmitting.value) {
        return;
    }

    emit('close');
};
</script>

<template>
    <Modal
        size="sm"
        :show-modal="showModal"
        :is-loading="isSubmitting"
        :no-click-away="isSubmitting"
        :no-backdrop-close="isSubmitting"
        :title="
            $t({
                defaultMessage: 'Turn off automatic top-up',
                description: 'Title of the modal that turns a wallet automatic top-up off',
                id: 'auto_topup_cancellation_modal.title',
            })
        "
        :confirm-button-text="
            $t({
                defaultMessage: 'Yes, turn it off',
                description: 'Button confirming that a wallet automatic top-up is turned off',
                id: 'auto_topup_cancellation_modal.confirm',
            })
        "
        :cancel-button-text="
            $t({
                defaultMessage: 'Cancel',
                description: 'Button dismissing the modal that turns a wallet automatic top-up off',
                id: 'auto_topup_cancellation_modal.cancel',
            })
        "
        @confirm="handleConfirm"
        @close="handleClose"
    >
        <template #body>
            <div
                class="sv-auto-topup-cancellation-modal sv-auto-topup-cancellation-modal__body flex flex-col gap-3"
            >
                <Typography
                    variant="body-sm"
                    shade="lighter"
                    tag="p"
                    class="sv-auto-topup-cancellation-modal__explanation"
                >
                    {{ explanation }}
                </Typography>

                <ErrorNotification
                    v-if="hasFailed"
                    class="sv-auto-topup-cancellation-modal__error sv-error"
                    :title="
                        $t({
                            defaultMessage:
                                'Could not turn off the automatic top-up. Please try again later.',
                            description:
                                'Error shown when turning a wallet automatic top-up off failed',
                            id: 'auto_topup_cancellation_modal.failed',
                        })
                    "
                />
            </div>
        </template>
    </Modal>
</template>
