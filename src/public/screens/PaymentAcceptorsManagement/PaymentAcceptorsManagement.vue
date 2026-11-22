<script setup lang="ts">
import { ref } from 'vue';
import {
    Button,
    ErrorNotification,
    Modal,
    PaymentAcceptor as PaymentAcceptorRow,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { Customer, PaymentAcceptor } from '@solvimon/solvimon-types';
import ScreenTitle from '@/components/shared/ScreenTitle/ScreenTitle.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import PaymentAcceptorList from '@/components/payments/PaymentAcceptors/PaymentAcceptorList.vue';
import { useActionDispatchProvider, useLogger } from '@/components/providers';
import { usePaymentAcceptorMenuItems } from '@/composables/usePaymentAcceptorMenuItems';
import { usePaymentAcceptors } from '@/composables/usePaymentAcceptors';

const props = defineProps<{ customerId: Customer['id'] }>();

const { $t } = useIntl();
const logger = useLogger();
const { dispatchAction } = useActionDispatchProvider();

const paymentAcceptors = usePaymentAcceptors({ customerId: () => props.customerId });
const { items, isPending, error } = paymentAcceptors;

const isLoading = ref(true);
void paymentAcceptors.fetchAll().finally(() => {
    isLoading.value = false;
});

const add = () => dispatchAction({ action: 'add-payment-acceptor' });

const pendingDelete = ref<PaymentAcceptor>();
const isDeleting = ref(false);
const hasDeleteFailed = ref(false);

const { getMenuItems } = usePaymentAcceptorMenuItems({
    onEdit: (paymentAcceptor) =>
        dispatchAction({
            action: 'edit-payment-acceptor',
            data: { paymentAcceptorId: paymentAcceptor.id },
        }),
    onDelete: (paymentAcceptor) => {
        hasDeleteFailed.value = false;
        pendingDelete.value = paymentAcceptor;
    },
});

const closeDelete = () => {
    if (isDeleting.value) return;
    pendingDelete.value = undefined;
};

const confirmDelete = async () => {
    const paymentAcceptor = pendingDelete.value;

    if (!paymentAcceptor || isDeleting.value) return;

    isDeleting.value = true;
    hasDeleteFailed.value = false;

    try {
        await paymentAcceptors.remove(paymentAcceptor);
        pendingDelete.value = undefined;
    } catch (deleteError) {
        logger.error(
            'PAYMENT_ACCEPTOR_DELETE_FAILED',
            'Failed to delete the payment acceptor',
            {},
            deleteError,
        );
        hasDeleteFailed.value = true;
    } finally {
        isDeleting.value = false;
    }
};
</script>

<template>
    <div class="sv-payment-acceptors-management sv-root sv-screen grid grid-cols-1 gap-6">
        <ScreenTitle
            :title="
                $t({
                    defaultMessage: 'Payment acceptors',
                    id: 'screens.payment_acceptors_management.title',
                    description:
                        'Title of the screen that lists the bank accounts the customer is paid into',
                })
            "
            :description="
                $t({
                    defaultMessage:
                        'Where you receive payments for your self-billing subscriptions. Each subscription uses all of them unless you choose specific ones.',
                    id: 'customer_overview.payment_acceptors_block.description_uses_all',
                    description:
                        'Explains the payment acceptors block on the customer overview and the payment acceptors screen: where the customer is paid, and that subscriptions use all of them unless specific ones are chosen',
                })
            "
        >
            <template #right>
                <Button
                    intent="secondary"
                    icon-prefix="add"
                    type="button"
                    class="sv-action sv-action--secondary sv-payment-acceptors-management__add w-full md:float-right md:w-auto"
                    @click="add"
                    >{{
                        $t({
                            defaultMessage: 'Add payment acceptor',
                            id: 'customer_overview.payment_acceptors_block.add_button_label',
                            description:
                                'Label of the link that opens the form for a first bank account',
                        })
                    }}</Button
                >
            </template>
        </ScreenTitle>

        <ErrorNotification
            v-if="error"
            class="sv-payment-acceptors-management__error sv-error"
            :title="
                $t({
                    defaultMessage: 'We could not load your payment acceptors.',
                    id: 'customer_overview.payment_acceptors_block.load_error',
                    description:
                        'Shown in the payment acceptors block when the bank accounts cannot be loaded',
                })
            "
        />

        <Skeleton
            v-else-if="isLoading || (isPending && !items.length)"
            variant="section"
            class="min-h-[100px]"
        />

        <PaymentAcceptorList
            v-else-if="items.length"
            class="sv-payment-acceptors-management__list"
            :payment-acceptors="items"
            :get-menu-items="getMenuItems"
        />

        <EmptyStatePlaceholder
            v-else
            class="sv-payment-acceptors-management__empty"
            icon="checkbook"
        >
            <template #title>
                {{
                    $t({
                        defaultMessage: 'No payment acceptors yet',
                        id: 'customer_overview.payment_acceptors_block.empty',
                        description:
                            'Shown in the payment acceptors block when the customer has no bank accounts',
                    })
                }}
            </template>
        </EmptyStatePlaceholder>

        <Modal
            full-screen-on-mobile
            size="md"
            :show-modal="!!pendingDelete"
            :is-loading="isDeleting"
            :no-click-away="isDeleting"
            :no-backdrop-close="isDeleting"
            :title="
                $t({
                    defaultMessage: 'Delete payment acceptor',
                    id: 'payment_acceptors_modal.delete.title',
                    description: 'Title of the payment acceptors modal while a delete is confirmed',
                })
            "
            :confirm-button-text="
                $t({
                    defaultMessage: 'Delete',
                    id: 'payment_acceptors_modal.delete_button.label',
                    description: 'Label of the button that confirms deleting a bank account',
                })
            "
            :cancel-button-text="
                $t({
                    defaultMessage: 'Cancel',
                    id: 'payment_acceptors_modal.cancel_button.label',
                    description:
                        'Label of the button that closes the payment acceptors modal without saving',
                })
            "
            @confirm="confirmDelete"
            @close="closeDelete"
        >
            <template v-if="pendingDelete" #body>
                <div class="sv-payment-acceptors-management__delete grid grid-cols-1 gap-3 pb-4">
                    <Typography variant="body-sm" color="secondary" tag="p">
                        {{
                            $t({
                                defaultMessage:
                                    'You will no longer be paid into this bank account.',
                                id: 'payment_acceptors_modal.delete.message',
                                description:
                                    'Explains what deleting a bank account does, above the account',
                            })
                        }}
                    </Typography>
                    <Section>
                        <PaymentAcceptorRow :payment-acceptor="pendingDelete" />
                    </Section>
                    <ErrorNotification
                        v-if="hasDeleteFailed"
                        class="sv-error"
                        :title="
                            $t({
                                defaultMessage: 'Something went wrong. Please try again.',
                                id: 'payment_acceptors_modal.error',
                                description:
                                    'Error shown in the payment acceptors modal when a change cannot be made',
                            })
                        "
                    />
                </div>
            </template>
        </Modal>
    </div>
</template>
