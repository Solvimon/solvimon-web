<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue';
import { Button, ErrorNotification, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { ShippingInformationProps } from './ShippingInformation.types';
import ShippingAddressCard from '@/components/customer/ShippingAddresses/ShippingAddressCard.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useShippingAddresses } from '@/composables/useShippingAddresses';

/** Most customers never open it, so it is not part of the overview until one does. */
const ShippingAddressesModal = defineAsyncComponent(
    () => import('@/components/customer/ShippingAddresses/ShippingAddressesModal.vue'),
);

const props = defineProps<ShippingInformationProps>();

const { $t } = useIntl();

const shippingAddresses = useShippingAddresses({ customerId: () => props.customer?.id });
const { items, defaultAddress, isPending, error } = shippingAddresses;

/** Loaded once the customer is known; the addresses belong to them. */
watch(
    () => props.customer?.id,
    (customerId) => {
        if (customerId) void shippingAddresses.fetchAll();
    },
    { immediate: true },
);

const hasOpenedManage = ref(false);
const isManaging = ref(false);

const openManage = () => {
    hasOpenedManage.value = true;
    isManaging.value = true;
};
</script>

<template>
    <Skeleton
        v-if="isLoading || !customer"
        variant="section"
        class="sv-shipping-information sv-root sv-component sv-loading min-h-[100px]"
    />
    <Section
        v-else
        class="sv-shipping-information sv-root sv-component"
        :title="
            $t({
                defaultMessage: 'Shipping information',
                id: 'customer_overview.shipping_information_block.title',
                description: 'Title of the block that shows the customer default shipping address',
            })
        "
    >
        <template #right>
            <Button
                size="sm"
                intent="subtle"
                class="sv-action sv-action--ghost sv-shipping-information__manage"
                @click="openManage"
                >{{
                    $t({
                        defaultMessage: 'Manage',
                        id: 'customer_overview.shipping_information_block.manage_button_label',
                        description:
                            'Label of the button that opens the list of the customer shipping addresses',
                    })
                }}</Button
            >
        </template>

        <ErrorNotification
            v-if="error"
            class="sv-shipping-information__error sv-error"
            :title="
                $t({
                    defaultMessage: 'We could not load your shipping addresses.',
                    id: 'customer_overview.shipping_information_block.load_error',
                    description:
                        'Shown in the shipping information block when the addresses cannot be loaded',
                })
            "
        />

        <Skeleton v-else-if="isPending && !items.length" variant="section" class="min-h-[60px]" />

        <ShippingAddressCard
            v-else-if="defaultAddress"
            class="sv-shipping-information__default"
            :address="defaultAddress"
        />

        <Typography
            v-else
            variant="body-sm"
            color="subtle"
            tag="p"
            class="sv-shipping-information__empty"
        >
            {{
                $t({
                    defaultMessage: 'No default shipping address yet.',
                    id: 'customer_overview.shipping_information_block.empty',
                    description:
                        'Shown in the shipping information block when the customer has no default shipping address',
                })
            }}
        </Typography>

        <ShippingAddressesModal
            v-if="hasOpenedManage && customer"
            :show-modal="isManaging"
            :customer="customer"
            :addresses="items"
            :is-loading="isPending"
            :actions="shippingAddresses"
            @close="isManaging = false"
        />
    </Section>
</template>
