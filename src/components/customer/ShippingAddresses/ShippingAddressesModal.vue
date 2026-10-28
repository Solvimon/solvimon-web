<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    Button,
    ErrorNotification,
    Modal,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type {
    ShippingAddressesModalEmits,
    ShippingAddressesModalProps,
    ShippingAddressesModalStart,
} from './ShippingAddressesModal.types';
import ShippingAddressCard from './ShippingAddressCard.vue';
import ShippingAddressList from './ShippingAddressList.vue';
import ShippingAddressForm from '@/components/customer/ShippingAddressForm/ShippingAddressForm.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';
import { useLogger } from '@/components/providers';
import type { ShippingAddressReplacement } from '@/composables/useShippingAddresses';
import { useShippingAddressMenuItems } from '@/composables/useShippingAddressMenuItems';
import type { ShippingAddress } from '@/types/shippingAddress';

type Step = ShippingAddressesModalStart['step'];

const PANES = ['LIST', 'FORM', 'DELETE'] as const;

const props = defineProps<ShippingAddressesModalProps>();
const emit = defineEmits<ShippingAddressesModalEmits>();

const { $t } = useIntl();
const logger = useLogger();

const step = ref<Step>('LIST');
/** The step the modal opened on, which is where closing it is one step back. */
const openedAt = ref<Step>('LIST');
/** The address being edited or deleted. */
const target = ref<ShippingAddress>();
const isWorking = ref(false);
const errorMessage = ref<string>();
/**
 * How far replacing each edited address got, which saving it again carries on from, also after
 * going back to the list and opening it again.
 */
const replacements = new Map<ShippingAddress['id'], ShippingAddressReplacement>();
const replacement = ref<ShippingAddressReplacement>({});

const formRef = ref<InstanceType<typeof ShippingAddressForm>>();

/**
 * The form is built afresh every time the customer goes to it, so one they gave up on does not
 * come back half filled in.
 */
const formKey = ref(0);

const pane = computed(() => (step.value === 'ADD' || step.value === 'EDIT' ? 'FORM' : step.value));

const somethingWentWrong = () =>
    $t({
        defaultMessage: 'Something went wrong. Please try again.',
        id: 'shipping_addresses_modal.error',
        description: 'Error shown in the shipping addresses modal when a change cannot be made',
    });

const goTo = (next: ShippingAddressesModalStart) => {
    errorMessage.value = undefined;
    target.value = 'address' in next ? next.address : undefined;
    if (next.step === 'ADD' || next.step === 'EDIT') formKey.value += 1;
    if (next.step === 'EDIT') {
        if (!replacements.has(next.address.id)) replacements.set(next.address.id, {});
        replacement.value = replacements.get(next.address.id)!;
    }
    step.value = next.step;
};

watch(
    () => props.showModal,
    (isShown) => {
        if (!isShown) return;

        const start = props.start ?? { step: 'LIST' };
        openedAt.value = start.step;
        goTo(start);
    },
    { immediate: true },
);

/** Done with an address: back to the list, unless the modal was opened for just that. */
const finish = () => {
    if (openedAt.value === 'LIST') {
        goTo({ step: 'LIST' });
        return;
    }

    emit('close');
};

/** Runs a change, holding the modal while it is out and saying so when it fails. */
const run = async (change: () => Promise<unknown>, onError: (error: unknown) => void) => {
    isWorking.value = true;
    errorMessage.value = undefined;

    try {
        await change();
        return true;
    } catch (error) {
        onError(error);
        errorMessage.value = somethingWentWrong();
        return false;
    } finally {
        isWorking.value = false;
    }
};

const save = async () => {
    // A second confirm while the first is still being checked would store the address twice.
    if (isWorking.value) return;

    isWorking.value = true;
    let payload: Awaited<ReturnType<NonNullable<typeof formRef.value>['submit']>>;
    try {
        payload = await formRef.value?.submit();
    } finally {
        isWorking.value = false;
    }

    if (!payload) return;

    const editing = step.value === 'EDIT' ? target.value : undefined;

    const saved = await run(
        () =>
            editing
                ? props.actions.replace(editing, payload, replacement.value)
                : props.actions.create(payload),
        (error) =>
            logger.error(
                'SHIPPING_ADDRESS_SAVE_FAILED',
                'Failed to save the shipping address',
                {},
                error,
            ),
    );

    // The list has reloaded with the change by now.
    if (saved) finish();
};

const confirmDelete = async () => {
    const address = target.value;

    if (!address || isWorking.value) return;

    const deleted = await run(
        () => props.actions.remove(address),
        (error) =>
            logger.error(
                'SHIPPING_ADDRESS_DELETE_FAILED',
                'Failed to delete the shipping address',
                {},
                error,
            ),
    );

    if (deleted) finish();
};

const { getMenuItems } = useShippingAddressMenuItems({
    onEdit: (address) => goTo({ step: 'EDIT', address }),
    onDelete: (address) => goTo({ step: 'DELETE', address }),
});

const handleClose = () => {
    if (isWorking.value) return;

    if (step.value === openedAt.value) {
        emit('close');
        return;
    }

    goTo({ step: 'LIST' });
};

const handleConfirm = () => {
    if (pane.value === 'FORM') void save();
    if (pane.value === 'DELETE') void confirmDelete();
};

const title = computed(() => {
    switch (step.value) {
        case 'ADD':
            return $t({
                defaultMessage: 'Add shipping address',
                id: 'shipping_addresses_modal.add.title',
                description: 'Title of the shipping addresses modal while a new address is added',
            });
        case 'EDIT':
            return $t({
                defaultMessage: 'Edit shipping address',
                id: 'shipping_addresses_modal.edit.title',
                description: 'Title of the shipping addresses modal while an address is changed',
            });
        case 'DELETE':
            return $t({
                defaultMessage: 'Delete shipping address',
                id: 'shipping_addresses_modal.delete.title',
                description: 'Title of the shipping addresses modal while a delete is confirmed',
            });
        default:
            return $t({
                defaultMessage: 'Shipping addresses',
                id: 'shipping_addresses_modal.title',
                description: 'Title of the modal that lists the customer shipping addresses',
            });
    }
});

const confirmButtonText = computed(() => {
    if (pane.value === 'FORM') {
        return $t({
            defaultMessage: 'Save address',
            id: 'shipping_addresses_modal.save_button.label',
            description: 'Label of the button that stores a new or changed shipping address',
        });
    }

    if (pane.value === 'DELETE') {
        return $t({
            defaultMessage: 'Delete',
            id: 'shipping_addresses_modal.delete_button.label',
            description: 'Label of the button that confirms deleting a shipping address',
        });
    }

    return undefined;
});

const cancelButtonText = computed(() => {
    if (step.value !== openedAt.value) {
        return $t({
            defaultMessage: 'Back',
            id: 'shipping_addresses_modal.back_button.label',
            description: 'Label of the button that goes back to the list of shipping addresses',
        });
    }

    return step.value === 'LIST'
        ? $t({
              defaultMessage: 'Close',
              id: 'shipping_addresses_modal.close_button.label',
              description: 'Label of the button that closes the shipping addresses modal',
          })
        : $t({
              defaultMessage: 'Cancel',
              id: 'shipping_addresses_modal.cancel_button.label',
              description:
                  'Label of the button that closes the shipping addresses modal without saving or deleting',
          });
});
</script>

<template>
    <Modal
        no-click-away
        size="lg"
        :show-modal="showModal"
        :title="title"
        :confirm-button-text="confirmButtonText"
        :cancel-button-text="cancelButtonText"
        :is-loading="isWorking"
        @confirm="handleConfirm"
        @close="handleClose"
    >
        <!-- The list has nothing to confirm, so it closes with one button rather than two. -->
        <template v-if="step === 'LIST'" #footer>
            <Button
                size="lg"
                intent="secondary"
                class="sv-action sv-action--secondary sv-shipping-addresses-modal__close w-full"
                @click="handleClose"
                >{{ cancelButtonText }}</Button
            >
        </template>

        <template #body>
            <div class="sv-shipping-addresses-modal grid grid-cols-1 gap-4 pb-4">
                <ErrorNotification
                    v-if="errorMessage"
                    class="sv-shipping-addresses-modal__error sv-error"
                    :title="errorMessage"
                />

                <SlidingPanes :panes="PANES" :current="pane">
                    <template #LIST>
                        <div class="sv-shipping-addresses-modal__list grid grid-cols-1 gap-4">
                            <ShippingAddressList
                                v-if="addresses.length"
                                :addresses="addresses"
                                :get-menu-items="getMenuItems"
                            />

                            <EmptyStatePlaceholder
                                v-else-if="!isLoading"
                                class="sv-shipping-addresses-modal__empty"
                                icon="home"
                            >
                                <template #title>
                                    {{
                                        $t({
                                            defaultMessage: 'No shipping addresses yet',
                                            id: 'shipping_addresses_modal.empty.title',
                                            description:
                                                'Shown in the shipping addresses modal when the customer has none',
                                        })
                                    }}
                                </template>
                            </EmptyStatePlaceholder>

                            <Button
                                class="sv-action sv-action--secondary sv-action--full-width sv-shipping-addresses-modal__add w-full"
                                intent="secondary"
                                icon-prefix="add"
                                type="button"
                                size="lg"
                                :disabled="isWorking"
                                @click="goTo({ step: 'ADD' })"
                            >
                                {{
                                    $t({
                                        defaultMessage: 'Add shipping address',
                                        id: 'shipping_addresses_modal.add_button.label',
                                        description:
                                            'Label of the button that moves to the form for a new shipping address',
                                    })
                                }}
                            </Button>
                        </div>
                    </template>

                    <template #FORM>
                        <div class="grid grid-cols-1 gap-3">
                            <ShippingAddressForm
                                ref="formRef"
                                :key="formKey"
                                :customer="customer"
                                :address="step === 'EDIT' ? target : undefined"
                                :disabled="isWorking"
                            />
                        </div>
                    </template>

                    <template #DELETE>
                        <div v-if="target" class="grid grid-cols-1 gap-3">
                            <Typography variant="body-sm" color="secondary" tag="p">
                                {{
                                    $t({
                                        defaultMessage:
                                            'This address will no longer be offered for shipping.',
                                        id: 'shipping_addresses_modal.delete.message',
                                        description:
                                            'Explains what deleting a shipping address does, above the address',
                                    })
                                }}
                            </Typography>
                            <Section class="sv-shipping-addresses-modal__pending-delete">
                                <ShippingAddressCard :address="target" />
                            </Section>
                        </div>
                    </template>
                </SlidingPanes>
            </div>
        </template>
    </Modal>
</template>
