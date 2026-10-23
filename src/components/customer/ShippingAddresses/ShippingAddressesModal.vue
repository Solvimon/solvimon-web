<script setup lang="ts">
import { computed, ref } from 'vue';
import {
    Button,
    ErrorNotification,
    Modal,
    Section,
    Typography,
    useIntl,
    type ContextMenuOption,
} from '@solvimon/solvimon-ui';
import type {
    ShippingAddressesModalEmits,
    ShippingAddressesModalProps,
} from './ShippingAddressesModal.types';
import ShippingAddressCard from './ShippingAddressCard.vue';
import ShippingAddressForm from '@/components/customer/ShippingAddressForm/ShippingAddressForm.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';
import { useLogger } from '@/components/providers';
import type { ShippingAddress } from '@/types/shippingAddress';

const PANES = ['LIST', 'ADD', 'DELETE'] as const;
type Pane = (typeof PANES)[number];

const props = defineProps<ShippingAddressesModalProps>();
const emit = defineEmits<ShippingAddressesModalEmits>();

const { $t } = useIntl();
const logger = useLogger();

const step = ref<Pane>('LIST');
const isWorking = ref(false);
const errorMessage = ref<string>();
const pendingDelete = ref<ShippingAddress>();

const formRef = ref<InstanceType<typeof ShippingAddressForm>>();

/**
 * The form is built afresh every time the customer goes to add an address, so one they gave up on
 * does not come back half filled in.
 */
const formKey = ref(0);

const somethingWentWrong = () =>
    $t({
        defaultMessage: 'Something went wrong. Please try again.',
        id: 'shipping_addresses_modal.error',
        description: 'Error shown in the shipping addresses modal when a change cannot be made',
    });

const goTo = (pane: Pane) => {
    errorMessage.value = undefined;
    step.value = pane;
};

const openAdd = () => {
    formKey.value += 1;
    goTo('ADD');
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
    const payload = await formRef.value?.submit();

    if (!payload) return;

    const saved = await run(
        () => props.actions.create(payload),
        (error) =>
            logger.error(
                'SHIPPING_ADDRESS_SAVE_FAILED',
                'Failed to save the shipping address',
                {},
                error,
            ),
    );

    // Back to the list, which has reloaded with the address on it by now.
    if (saved) goTo('LIST');
};

const confirmDelete = async () => {
    const address = pendingDelete.value;

    if (!address) return;

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

    if (deleted) {
        pendingDelete.value = undefined;
        goTo('LIST');
    }
};

const setDefault = (address: ShippingAddress) =>
    run(
        () => props.actions.setDefault(address),
        (error) =>
            logger.error(
                'SHIPPING_ADDRESS_SET_DEFAULT_FAILED',
                'Failed to set the default shipping address',
                {},
                error,
            ),
    );

const getMenuItems = (address: ShippingAddress): ContextMenuOption[] => [
    ...(address.is_default
        ? []
        : [
              {
                  label: $t({
                      defaultMessage: 'Set as default',
                      id: 'shipping_address.context_menu.set_as_default.label',
                      description: 'Menu option that makes a shipping address the default',
                  }),
                  onClick: () => void setDefault(address),
              },
          ]),
    {
        label: $t({
            defaultMessage: 'Delete',
            id: 'shipping_address.context_menu.delete.label',
            description: 'Menu option that deletes a shipping address',
        }),
        onClick: () => {
            pendingDelete.value = address;
            goTo('DELETE');
        },
    },
];

/** A step back while the customer is in a form or confirmation; closing from the list. */
const handleClose = () => {
    if (isWorking.value) return;

    if (step.value === 'LIST') {
        emit('close');
        return;
    }

    pendingDelete.value = undefined;
    goTo('LIST');
};

const handleConfirm = () => {
    if (step.value === 'ADD') void save();
    if (step.value === 'DELETE') void confirmDelete();
};

const title = computed(() =>
    step.value === 'ADD'
        ? $t({
              defaultMessage: 'Add shipping address',
              id: 'shipping_addresses_modal.add.title',
              description: 'Title of the shipping addresses modal while a new address is added',
          })
        : step.value === 'DELETE'
          ? $t({
                defaultMessage: 'Delete shipping address',
                id: 'shipping_addresses_modal.delete.title',
                description: 'Title of the shipping addresses modal while a delete is confirmed',
            })
          : $t({
                defaultMessage: 'Shipping addresses',
                id: 'shipping_addresses_modal.title',
                description: 'Title of the modal that lists the customer shipping addresses',
            }),
);

const confirmButtonText = computed(() =>
    step.value === 'ADD'
        ? $t({
              defaultMessage: 'Save address',
              id: 'shipping_addresses_modal.save_button.label',
              description: 'Label of the button that stores the new shipping address',
          })
        : step.value === 'DELETE'
          ? $t({
                defaultMessage: 'Delete',
                id: 'shipping_addresses_modal.delete_button.label',
                description: 'Label of the button that confirms deleting a shipping address',
            })
          : undefined,
);

const cancelButtonText = computed(() =>
    step.value === 'LIST'
        ? $t({
              defaultMessage: 'Close',
              id: 'shipping_addresses_modal.close_button.label',
              description: 'Label of the button that closes the shipping addresses modal',
          })
        : $t({
              defaultMessage: 'Back',
              id: 'shipping_addresses_modal.back_button.label',
              description: 'Label of the button that goes back to the list of shipping addresses',
          }),
);
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
        <template #body>
            <div class="sv-shipping-addresses-modal grid grid-cols-1 gap-4 pb-4">
                <ErrorNotification
                    v-if="errorMessage"
                    class="sv-shipping-addresses-modal__error sv-error"
                    :title="errorMessage"
                />

                <SlidingPanes :panes="PANES" :current="step">
                    <template #LIST>
                        <div class="sv-shipping-addresses-modal__list grid grid-cols-1 gap-2">
                            <Section
                                v-for="address in addresses"
                                :key="address.id"
                                class="sv-shipping-addresses-modal__item"
                            >
                                <ShippingAddressCard
                                    :address="address"
                                    :menu-items="getMenuItems(address)"
                                    show-default
                                />
                            </Section>

                            <EmptyStatePlaceholder
                                v-if="!addresses.length && !isLoading"
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
                                size="sm"
                                :disabled="isWorking"
                                @click="openAdd"
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

                    <template #ADD>
                        <ShippingAddressForm
                            ref="formRef"
                            :key="formKey"
                            :customer="customer"
                            :disabled="isWorking"
                        />
                    </template>

                    <template #DELETE>
                        <div v-if="pendingDelete" class="grid grid-cols-1 gap-3">
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
                                <ShippingAddressCard :address="pendingDelete" />
                            </Section>
                        </div>
                    </template>
                </SlidingPanes>
            </div>
        </template>
    </Modal>
</template>
