<script setup lang="ts">
import { Section } from '@solvimon/solvimon-ui';
import type { ShippingAddressListProps } from './ShippingAddressList.types';
import ShippingAddressCard from './ShippingAddressCard.vue';

defineProps<ShippingAddressListProps>();
</script>

<template>
    <Section no-spacing content-classes="divide-y divide-gray-100" class="sv-shipping-address-list">
        <div
            v-for="address in addresses"
            :key="address.id"
            class="sv-shipping-address-list__item px-3 py-2"
        >
            <ShippingAddressCard
                :address="address"
                :menu-items="getMenuItems?.(address)"
                :compact="compact"
                show-default
            />
        </div>
    </Section>
</template>
