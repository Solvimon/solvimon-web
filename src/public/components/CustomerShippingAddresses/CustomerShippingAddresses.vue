<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { Button, ErrorNotification, Section, useIntl } from '@solvimon/solvimon-ui';
import type { CustomerShippingAddressesProps } from './CustomerShippingAddresses.types';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import ShippingAddressList from '@/components/customer/ShippingAddresses/ShippingAddressList.vue';
import type { ShippingAddressesModalStart } from '@/components/customer/ShippingAddresses/ShippingAddressesModal.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useShippingAddresses } from '@/composables/useShippingAddresses';
import { useShippingAddressMenuItems } from '@/composables/useShippingAddressMenuItems';

/** Most customers never open it, so it is not part of the overview until one does. */
const ShippingAddressesModal = defineAsyncComponent(
    () => import('@/components/customer/ShippingAddresses/ShippingAddressesModal.vue'),
);

/** The block is a summary; Manage shows the rest. */
const ADDRESSES_SHOWN = 3;

const props = defineProps<CustomerShippingAddressesProps>();

const { $t } = useIntl();

const shippingAddresses = useShippingAddresses({ customerId: () => props.customer?.id });
const { items, isPending, error } = shippingAddresses;

const shownAddresses = computed(() => items.value.slice(0, ADDRESSES_SHOWN));

/** Loaded once the customer is known; the addresses belong to them. */
watch(
    () => props.customer?.id,
    (customerId) => {
        if (customerId) void shippingAddresses.fetchAll();
    },
    { immediate: true },
);

const hasOpenedModal = ref(false);
const isModalShown = ref(false);
const modalStart = ref<ShippingAddressesModalStart>({ step: 'LIST' });

const openModal = (start: ShippingAddressesModalStart) => {
    modalStart.value = start;
    hasOpenedModal.value = true;
    isModalShown.value = true;
};

const { getMenuItems } = useShippingAddressMenuItems({
    onEdit: (address) => openModal({ step: 'EDIT', address }),
    onDelete: (address) => openModal({ step: 'DELETE', address }),
});
</script>

<template>
    <Skeleton
        v-if="isLoading || !customer"
        variant="section"
        class="sv-shipping-addresses sv-root sv-component sv-loading min-h-[100px]"
    />
    <Section
        v-else
        class="sv-shipping-addresses sv-root sv-component"
        no-spacing
        no-border
        content-background="none"
        :title="
            $t(
                {
                    defaultMessage:
                        '{count, plural, one {Shipping address} other {Shipping addresses}}',
                    id: 'customer_overview.shipping_addresses_block.title',
                    description: 'Title of the block that lists the customer shipping addresses',
                },
                { count: String(items.length) },
            )
        "
    >
        <template #right>
            <Button
                size="xs"
                intent="subtle"
                class="sv-action sv-action--ghost sv-shipping-addresses__manage"
                @click="openModal({ step: 'LIST' })"
                >{{
                    $t({
                        defaultMessage: 'Manage',
                        id: 'customer_overview.shipping_addresses_block.manage_button_label',
                        description:
                            'Label of the button that opens the modal to manage the customer shipping addresses',
                    })
                }}</Button
            >
        </template>

        <div class="grid grid-cols-1 gap-2">
            <ErrorNotification
                v-if="error"
                class="sv-shipping-addresses__error sv-error"
                :title="
                    $t({
                        defaultMessage: 'We could not load your shipping addresses.',
                        id: 'customer_overview.shipping_addresses_block.load_error',
                        description:
                            'Shown in the shipping addresses block when the addresses cannot be loaded',
                    })
                "
            />

            <Skeleton
                v-else-if="isPending && !items.length"
                variant="section"
                class="min-h-[60px]"
            />

            <ShippingAddressList
                v-else-if="items.length"
                class="sv-shipping-addresses__list"
                :addresses="shownAddresses"
                :get-menu-items="getMenuItems"
                compact
            />

            <EmptyStatePlaceholder v-else class="sv-shipping-addresses__empty" icon="home">
                <template #title>
                    {{
                        $t({
                            defaultMessage: 'No shipping addresses yet',
                            id: 'customer_overview.shipping_addresses_block.empty',
                            description:
                                'Shown in the shipping addresses block when the customer has no shipping addresses',
                        })
                    }}
                </template>
                <template #message>
                    <!-- A link to the eye, in the text's own size and colour, but it opens the modal
                         rather than going anywhere. -->
                    <button
                        type="button"
                        class="sv-action sv-action--link sv-shipping-addresses__add underline"
                        @click="openModal({ step: 'ADD' })"
                    >
                        {{
                            $t({
                                defaultMessage: 'Add shipping address',
                                id: 'customer_overview.shipping_addresses_block.add_button_label',
                                description:
                                    'Label of the link that opens the form for a first shipping address',
                            })
                        }}
                    </button>
                </template>
            </EmptyStatePlaceholder>
        </div>

        <ShippingAddressesModal
            v-if="hasOpenedModal && customer"
            :show-modal="isModalShown"
            :start="modalStart"
            :customer="customer"
            :addresses="items"
            :is-loading="isPending"
            :actions="shippingAddresses"
            @close="isModalShown = false"
        />
    </Section>
</template>
