<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import type { ShippingAddress } from '@solvimon/solvimon-types';
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

/**
 * Looked up once, as the form opens: a save replaces the address with a new one, and the reload
 * after it would no longer find the one the form was opened with.
 */
const address = shallowRef<ShippingAddress>();
const isAddressMissing = ref(false);
const hasLoadFailed = ref(false);

const loadAddress = async () => {
    await shippingAddresses.fetchAll();

    // `fetchAll` reports its own failure; a list that did not load says nothing about the address.
    if (shippingAddresses.error.value) {
        hasLoadFailed.value = true;
        return;
    }

    address.value = shippingAddresses.items.value.find(({ id }) => id === shippingAddressId);
    isAddressMissing.value = !address.value;
};

const { isLoading } = useLoadInitialData(
    get.execute(),
    ...(shippingAddressId ? [loadAddress()] : []),
);
</script>

<template>
    <slot
        name="default"
        :customer="customer"
        :address="address"
        :is-address-missing="isAddressMissing"
        :has-load-failed="hasLoadFailed || (!isLoading && !customer)"
        :is-loading="isLoading"
        :actions="shippingAddresses"
    />
</template>
