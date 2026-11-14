<script setup lang="ts">
import ShippingAddressForm from './ShippingAddressForm.vue';
import ShippingAddressFormEntryView from './ShippingAddressForm.entry.view.vue';
import type { SolvimonShippingAddressFormEntryProps } from './ShippingAddressForm.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('shipping-address-form');

defineProps<SolvimonShippingAddressFormEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
    >
        <ShippingAddressFormEntryView v-bind="$props">
            <template
                #default="{
                    customer,
                    address,
                    isAddressMissing,
                    hasLoadFailed,
                    isLoading,
                    actions,
                }"
            >
                <ShippingAddressForm
                    :customer="customer"
                    :address="address"
                    :is-address-missing="isAddressMissing"
                    :has-load-failed="hasLoadFailed"
                    :is-loading="isLoading"
                    :actions="actions"
                />
            </template>
        </ShippingAddressFormEntryView>
    </EntryProvider>
</template>
