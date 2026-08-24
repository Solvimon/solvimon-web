<script setup lang="ts">
import { Modal } from '@solvimon/solvimon-ui';
import { computed, ref } from 'vue';
import type { WalletModalShellEmits, WalletModalShellProps } from './WalletModalShell.types';
import AddPaymentMethodPane from '@/components/payments/AddPaymentMethodPane/AddPaymentMethodPane.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';

const props = defineProps<WalletModalShellProps>();
defineEmits<WalletModalShellEmits>();

const paneRef = ref<InstanceType<typeof AddPaymentMethodPane>>();

/** The panes the host fills. The add-payment-method one is drawn here, so it is not among them. */
const hostPanes = computed(() => props.panes.filter((pane) => pane !== props.addPaymentMethodPane));

defineExpose({
    submit: () => paneRef.value?.submit(),
    isSaving: computed(() => !!paneRef.value?.isSaving),
});
</script>

<template>
    <Modal
        no-click-away
        :show-modal="showModal"
        size="lg"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-loading="isPending"
        @confirm="$emit('confirm')"
        @close="$emit('cancel')"
    >
        <template #body>
            <div class="grid grid-cols-1 gap-4 pb-4">
                <SlidingPanes :panes="panes" :current="step">
                    <template #[addPaymentMethodPane]>
                        <AddPaymentMethodPane
                            ref="paneRef"
                            :customer="customer"
                            :payment-method-options="paymentMethodOptions"
                            :is-loading="isPaymentMethodOptionsPending"
                            :is-active="isAddingPaymentMethod"
                            @success="$emit('payment-success')"
                            @failure="(error) => $emit('payment-failed', error)"
                        />
                    </template>

                    <template v-for="pane in hostPanes" #[pane]>
                        <slot :name="pane" />
                    </template>
                </SlidingPanes>
            </div>
        </template>

        <template v-if="$slots.footer" #footer>
            <slot name="footer" />
        </template>
    </Modal>
</template>
