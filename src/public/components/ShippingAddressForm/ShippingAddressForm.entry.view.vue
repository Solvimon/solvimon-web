<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonShippingAddressFormEntryProps } from './ShippingAddressForm.entry.types';
import { useCustomer } from '@/composables/useCustomer';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useShippingAddresses } from '@/composables/useShippingAddresses';

const props = defineProps<SolvimonShippingAddressFormEntryProps>();

const customerId = props.portalObject.customer_id;
const shippingAddressId = props.configuration?.shippingAddressId;

const { customer, get } = useCustomer({ customerId });
// The portal reads addresses as a list only, so the one to edit is looked up in it.
const shippingAddresses = useShippingAddresses({ customerId });

const { isLoading } = useLoadInitialData(
    get.execute(),
    ...(shippingAddressId ? [shippingAddresses.fetchAll()] : []),
);

const address = computed(() =>
    shippingAddresses.items.value.find(({ id }) => id === shippingAddressId),
);
</script>

<template>
    <slot
        name="default"
        :customer="customer"
        :address="address"
        :is-address-missing="!!shippingAddressId && !isLoading && !address"
        :is-loading="isLoading"
        :actions="shippingAddresses"
    />
</template>
