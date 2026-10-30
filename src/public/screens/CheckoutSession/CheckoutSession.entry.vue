<script setup lang="ts">
import type { SolvimonCheckoutSessionEntryProps } from './CheckoutSession.entry.types';
import SessionCheckout from './SessionCheckout.vue';
import CheckoutNotAvailable from '@/components/checkout/CheckoutNotAvailable.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('checkout-session');

defineProps<SolvimonCheckoutSessionEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CHECKOUT_SESSION']"
    >
        <SessionCheckout
            :portal-url-id="portalObject.id"
            :avatar="branding?.emblem?.public_url ?? undefined"
        />
        <template #portal-unavailable>
            <CheckoutNotAvailable class="sv-checkout sv-root sv-screen sv-checkout--error" />
        </template>
    </EntryProvider>
</template>
